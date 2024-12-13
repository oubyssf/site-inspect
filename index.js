#!/usr/bin/env node

/**
 * site-inspect
 * Site-Inspect is a command-line tool designed for web analysis and classification. 
 * It uses Playwright to visit URLs in a browser, parses the HTML content, and extracts text for analysis. 
 * Based on predefined keywords, Site-Inspect classifies the URLs, providing a streamlined solution for content categorization and inspection.
 */

const init = require('./src/init');
const {Monit} = require('./src/monit');
const {getURLStream} = require('./src/input');
const {validateOutputFile} = require('./src/io');
const sinspect = require('./src/sinspect');



(async () => {
	const urls = await getURLStream();
	const {fromFile} = urls

	const woutput = fromFile 
	? await validateOutputFile()
	: _=>_
	
	await init();
	
	const monitor = new Monit(urls.total)

	await sinspect(urls, monitor, woutput)

})();