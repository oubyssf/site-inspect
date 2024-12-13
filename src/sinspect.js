const cli = require('./cli');
const {flags} = cli;

const { formatRecord } = require('./format')
const { getDnsData } = require('./dns');
const { 
	getHBResponse, 
	launchBrowser, 
	waybackClosestSnapshot, 
	getWaybackSnapshot
} = require('./crawler');
const { deltaT } = require('./utils');
const Kefir = require('kefir');


const BATCH_SIZE = flags.batchSize



async function sinspect(urls, monitor, woutput, start=0) {
	const {source, total, fromFile} = urls;
	if (start >= total) {
		process.exit(0)
		return
	}

	const now = new Date()
	const nextStart = start + BATCH_SIZE
	monitor.log(`Started process for URLs (${start+1}-${Math.min(total, nextStart)})`)
	
	const browser = await launchBrowser()
	
	const inputStream = source().
		skip(start).
		take(BATCH_SIZE)

	inputStream.onValue(record => {
		monitor.log({
			msg: 'Started processing URL:', 
			record,
		})
		monitor.monit({
			key: record.id,
			url: record.parsedUrl.href,
			status: `STARTED`
		})
	})

	const dnsStream = inputStream.flatMap(getDnsData)
	dnsStream.onValue(record => {
		monitor.log({msg: 'Visiting URL:', record})
		monitor.monit({
			key: record.id,
			url: record.parsedUrl.href,
			status: `VISITING`
		})
	})
	dnsStream.onError(record => {
		monitor.log({
			msg: 'DNS lookup failed for:', 
			record,
		}, 'error')
        monitor.monit({
			key: record.id,
			url: record.parsedUrl.href,
			status: `FINISHED`
		})
	})

	const browserStream = dnsStream
        .flatMap(r => getHBResponse(browser, r, monitor))
    browserStream.onError(record => {
        monitor.monit({
			key: record.id,
			url: record.parsedUrl.href,
			status: `FINISHED`
		})
    })
    
	const blocked = browserStream
		.filter(({record}) => record.blocked)

	blocked.onValue(record => {
		monitor.log({
			msg: 'Access blocked for:',
			record
		}, 'warning')
		
		monitor.log({
			msg: 'Attempting to retrieve closest Wayback Machine snapshot for:',
			record
		})
        monitor.monit({
			key: record.id,
			url: record.parsedUrl.href,
			status: `BLOCKED`
		})
	})

    const finished = browserStream
		.filter(({record}) => !record.blocked)

	const retsnapshots = blocked
		.flatMapConcat(v => Kefir.later(5000, v))
		.flatMap(v => (
			Kefir
				.fromPromise(waybackClosestSnapshot(v.parsedUrl))
				.map(wbs => ({...v, ...wbs}))
				.mapErrors(wbs => ({...v, ...wbs}))
		))
    retsnapshots.onError(record => {
        monitor.monit({
            key: record.id,
            url: record.parsedUrl.href,
            status: `FINISHED`
        })
    })

	const noWbSnapshots = retsnapshots
		.filter(r => r.wbSnapshot===null)
    noWbSnapshots.onValue(record => {
        monitor.log({
            msg: 'No Wayback Machine snapshot found for:',
            record
        }, 'warning')
    })
    
    const wbSnapshotFound = retsnapshots
		.filter(r => r.wbSnapshot!=null)

	wbSnapshotFound.onValue(record => {
		monitor.log({
			msg: 'Wayback Machine snapshot found for:',
			record
		})
        monitor.monit({
            key: record.id,
            url: record.parsedUrl.href,
            status: `WBMACHINE`
        })
	})

	const wbSnapshots = wbSnapshotFound
		.flatMap(r => getWaybackSnapshot(browser, r, monitor))
    wbSnapshots.onError(record => {
        monitor.log({
			msg: 'Failed to retrieve Wayback Machine snapshot for:',
			record
		})
    })
    const snapshots = Kefir
        .concat([noWbSnapshots, wbSnapshots])

	const final = Kefir
		.concat([finished, snapshots])

    const ffinal = final.map(formatRecord)
	fromFile && ffinal.flatMapErrors(Kefir.constant).onValue(woutput)
    
	if(flags.debug){final.log()}

	
    if (!flags.monit && !fromFile)
	{ ffinal.log('sinspect') }

    final.onValue(value => {
        value.wbSnapshot && monitor.log({
            msg: 'Wayback Machine snapshot successfully retrieved for:',
            record
        })
        monitor.log({
            msg: 'Finished processing URL:',
            record: value,
        })
        monitor.monit({
            key: value.id,
            url: value.parsedUrl.href,
            status: `FINISHED`
        })
    })

    final.onError(value => {
        monitor.log({
            msg: 'Finished processing URL:',
            record: value,
        }, 'error')
        monitor.monit({
            key: value.id,
            url: value.parsedUrl.href,
            status: `FINISHED`
        })
    })

    final.onEnd(async () => {
        await browser.close();
        const batch = `${start+1}-${Math.min(total, nextStart)}`
        const finishedIn = deltaT(new Date() - now)
        monitor.log(
            `Finished process for (URLs ${batch}) in ${finishedIn}`
        )
        monitor.workers.clear()
        await sinspect(
            urls,
            monitor,
            woutput,
            nextStart,
        )
    })
}

module.exports = sinspect