const Kefir = require('kefir')
const {chromium} = require('playwright')
const { isNotRetryableError } = require('./errors')
const { Page } = require('./parsePage')
const { flags } = require("./cli")
const axios = require('axios')
const { Monit } = require('./monit')
const {parseWbTimestamp} = require('./utils')


const TIMEOUT = flags.timeout
const RETRIES = Number(flags.retries)
const headless = !flags.headed
const wae = 'http://web.archive.org/web/';
const cdxe = `https://web.archive.org/cdx/search/cdx`;
const CF_CHALLENGE_URL = 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/';
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36 Edg/116.0.1938.81';
const headers = {
     "User-Agent": userAgent,
     "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
     "Accept-Language": "en-US,en;q=0.5",
     "Accept-Encoding": "gzip, deflate, br",
     "Connection": "keep-alive",
     "Upgrade-Insecure-Requests": "1",
     "Sec-Fetch-Dest": "document",
     "Sec-Fetch-Mode": "navigate",
     "Sec-Fetch-Site": "none",
     "Sec-Fetch-User": "?1",
     'Sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"'
};
   

const contextOptions = {
     ignoreHTTPSErrors: true,
     userAgent,
     bypassCSP: true,
     locale: 'en-US',
     viewport: { width: 1920, height: 1080 },
}

async function launchBrowser() {
     return chromium.launch({
          headless,
          ignoreHTTPSErrors: true,
     })
}

const waitForNetIdle = async (page) => {
     try {
          await page.waitForLoadState('networkidle', {timeout: Math.round(TIMEOUT/2)})
     } catch {}
}

const getFrameBodyText = async (f) => {
     try{
          const bodyText = await f.
               locator('body', {timeout: 500}).
               innerText()
          return bodyText
     } catch {
          return ''
     }
}

const getFrameInnerText = async (mainFrame) => {
     if(mainFrame.childFrames().length === 0)
          return await getFrameBodyText(mainFrame)
     
     let innerText = [await getFrameBodyText(mainFrame)]
     for(let cf of mainFrame.childFrames()){
          const cfText = await getFrameInnerText(cf)
          innerText.push(cfText)
     }
     return innerText.join('\n')
}

const getPageContent = async (page) => {
     await waitForNetIdle(page)
     const content = await page.content()
     return new Page(content)
}

async function getBrowserContext(browser) {
     const context = await browser.newContext(contextOptions)
     await context.addInitScript('delete Object.getPrototypeOf(navigator).webdriver');
     await context.addInitScript(() => {
          Object.defineProperty(navigator, 'language', {
               get() {
                    return 'en-US';
               },
          });
     });
     await context.setExtraHTTPHeaders(headers)
     return context
}


async function getBContextPage(context) {
     const page = await context.newPage()
     await page.setExtraHTTPHeaders(headers)
     
     await page.route('**/*.{png,jpg,jpeg,svg,webp,css}', route => route.abort());
     await page.route('**/*', async route => {
          const oheaders = route.request().headers();
          await route.continue({ headers: {...oheaders, ...headers} });
     })

     return page
}

async function visit(browser, url, waitfornetidle=false) {
     const context = await getBrowserContext(browser);
     const page = await getBContextPage(context)
     
     let requestedDocs = [];
     const traceDocs = (resp) => {
          const no300status = resp.status() < 300 || resp.status() > 399;
          const isDoc = resp.request().resourceType() === "document"; 
          if(isDoc && no300status){
               requestedDocs.push({
                    url: resp.url(),
                    statusCode: resp.status()
               })
          }
     }
     
     page.on('response', traceDocs);
     
     await page.goto(String(url), {timeout: TIMEOUT})
     
     if(waitfornetidle) {
          await waitForNetIdle()
     }

     const pageContent = await getPageContent(page);
     const finalUrl = new URL(page.url());
     
     page.removeListener('response', traceDocs)
     
     await context.close()
     await page.close()

     return {
          finalUrl,
          requestedDocs,
          page: pageContent,
          
          get status() {
               const originm = ({url, _}) => (new URL(url).origin===this.finalUrl.origin)
               const sameo = this.requestedDocs.filter(originm)
               if(sameo.length > 0) {return String(sameo[0].statusCode)}
               return String('')
          },

          get blocked() {
               if(this.cloudflareChallenge || this.page.forbidden()) 
               { return true }
               return false
          }
     }
}

/**
 * Visits a given url
 * @param {Browser} browser 
 * @param {string|URL} url 
 * @returns 
 */
async function getHBUrlInfo (browser, url) {

     const pageR = await visit(browser, url)
     
     return {
          ...pageR,
          get cloudflareChallenge() {
               const lri = this.requestedDocs.length-1
               const lru = lri > 0 ? this.requestedDocs[lri].url : ''
               if(lru.includes(CF_CHALLENGE_URL)) 
               { return true }
               return false
          },
     }     
}


/**
 * @typedef {Object} Record
 * @property {string|number} record.id
 * @property {URL} record.parsedUrl
 * @property {number} record.numberOfTests
 * @param {Browser} browser 
 * @param {Record} record 
 * @param {Monit} monitor 
 * @returns 
 */

const getHBResponse = (browser, record, monitor) => {
     const action = i => {
          if(i > RETRIES) return false
          
          record.numberOfTests++;
          
          const stream = Kefir.fromPromise(
               getHBUrlInfo(browser, record.parsedUrl)
          )

          stream.onError(error => {
               const retries = i > 0 ? ` (Retry ${i}/${RETRIES})` : '';
               const msg = `Failed to visit URL${retries}:`;
               monitor.log({
                    msg, 
                    record: {...record, error}
               }, 'error')
          })
          
          return stream.filterErrors(
               error => (isNotRetryableError(error) || i === RETRIES)
          )
     }

     const stream = Kefir
          .repeat(action)
          .takeErrors(1)
          .take(1)
          .map(v => ({
               ...record,
               record: {...v},
               lastChecked: new Date()
          }))
          .mapErrors(error => ({
               ...record,
               error,
               lastChecked: new Date()
          }));
     
     return stream
}


/**
 * Get's closest wayback machine snapshot for a given web url
 * @param {string|URL} url
 * @typedef {Object} wbSnapshot
 * @property {string} timestamp
 * @property {string} url
 * @property {Date} date
 */

async function waybackClosestSnapshot(url){
     const params = {
         output: 'json',
         limit: -1,
         fl:'timestamp',
         url,
     }
     return axios
          .get(cdxe, {params})
          .then(response => response.data)
          .then(data => {
               if(data.length === 0) return { wbSnapshot: null }
     
               const timestamp = data[1][0];
               const snapurl = `${wae}${timestamp}id_/${url}` 
               const date = parseWbTimestamp(timestamp)
               
               return { 
                    wbSnapshot: {
                         timestamp, 
                         url: snapurl, 
                         date
                    } 
               }
          })
          .catch(error => {error})
}

/**
 * Get's snapshot from Wayback Machine with retries
 * @param {Browser} browser
 * @param {*} record
 * @param {Monit} monitor 
 */
function getWaybackSnapshot(browser, record, monitor) {
     const wbSnapshot = record.wbSnapshot
     if(wbSnapshot===null) return Kefir.constant(record)
     
     const stream = Kefir
          .fromPromise(visit(browser, wbSnapshot.url, true))
          .map(pageR => ({ 
               ...record, 
               wbSnapshot: {
                    ...wbSnapshot, 
                    ...pageR,
                    redirect: pageR.finalUrl.pathname.split('id_/')[1] 
               }
          }))
          .mapErrors(error => ({ 
               ...record, 
               error,
          }))
     return stream
     // return Kefir.repeat(i => {
     //      if(i > RETRIES) return false

     //      const stream = Kefir
     //           .fromPromise(visit(browser, wbSnapshot.url, true))

     //      stream.onError(error => {
     //           const retries = i > 0 ? ` (Retry ${i}/${RETRIES})` : '';
     //           const msg = `Failed to get Wayback snapshot${retries}:`;
     //           monitor.log({msg, record: {...record, error}}, 'error')
     //      })
          
     //      return stream.filterErrors(
     //           error => (isNotRetryableError(error) || i === RETRIES)
     //      )

     // })
     // .take(1)
     // .takeErrors(1)
}

module.exports = { 
     launchBrowser, 
     getHBResponse,
     getHBUrlInfo,
     getWaybackSnapshot,
     waybackClosestSnapshot,
}