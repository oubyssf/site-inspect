const meow = require('meow');
const meowHelp = require('cli-meow-help');

const flags = {
	clear: {
		type: `boolean`,
		default: false,
		alias: `c`,
		desc: `Clear the console`
	},
	input: {
		type: `string`,
		alias: `i`,
		desc: `Input file name`,
	},
	timeout: {
		type: `number`,
		default: 30000,
		alias: `T`,
		desc: `Timeout in milliseconds.`
	},
	retries: {
		type: `number`,
		default: 3,
		alias: `r`,
		desc: `Maximum number of retries before returning the result`
	},
	sheetn: {
		type: `number`,
		default: 0,
		desc: `Specify sheet number for xlsx files`
	},
	keyC: {
		type: `string`,
		default: 'CpyCode',
		alias: `k`,
		desc: `Key (id) column in the input file.`
	},
	addrC: {
		type: `string`,
		default: 'WebAddr',
		alias: `a`,
		desc: `Web address column in the input file.`
	},
	notC: {
		type: `string`,
		default: 'numberOfTests',
		alias: `n`,
		desc: `Specify number of tests column in the input file.`
	},
	delimiter: {
		type: `string`,
		default: `\t`,
		desc: `CSV delimiter`
	},
	batchSize: {
		type: `number`,
		default: 10,
		alias: `b`,
		desc: `Number of URLs to process in a single batch.`
	},
	output: {
		type: `string`,
		default: `results_(date-time).csv`,
		alias: `o`,
		desc: `Path to output file.`
	},
	monit: {
		type: `boolean`,
		default: false,
		alias: `m`,
		desc: `Monitor`
	},
	saveLogs: {
		type: `boolean`,
		default: false,
		desc: `Append logs to logs.txt file`
	},
	debug: {
		type: `boolean`,
		default: false,
		alias: `d`,
		desc: `Print debug info`
	},
	headed: {
		type: `boolean`,
		default: false,
		alias: `H`,
		desc: `Run headed browser`
	},
	version: {
		type: `boolean`,
		alias: `v`,
		desc: `Print CLI version`
	}
};

const commands = {
	help: { desc: `Print help info` },
};

const helpText = meowHelp({
	name: `site-inspect`,
	flags,
	commands
});

const options = {
	inferType: true,
	description: false,
	hardRejection: false,
	flags
};

module.exports = meow(helpText, options);
