// https://nodejs.org/docs/latest/api/dns.html#error-codes
const Kefir = require('kefir')
const dns = require('dns')


/**
 * @typedef {Object} Record
 * @property {number|string} Record.id
 * @property {URL} Record.parsedUrl
 * @property {number} Record.numberOfTests
 * @param {Record} record 
 * @returns
 */
function getDnsData(record) {
     return Kefir.fromNodeCallback((callback) => {
          dns.resolve(record.parsedUrl.hostname, (error, address) => {
               if (error) {
                    callback({
                         ...record,
                         numberOfTests: record.numberOfTests + 1,
                         error,
                         lastChecked: new Date()
                    }, null)
               } else {
                    callback(null, { 
                         ...record, 
                         address: address[0] 
                    })
               }
          });
     })
}

module.exports = { getDnsData }