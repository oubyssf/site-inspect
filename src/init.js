const pkg = require('../package.json');
const handleError = require('cli-handle-error');
const chalk = require('chalk')
const figlet = require("figlet");
const orange = chalk.hex('#FFA500');
const cli = require('./cli');
const {input, flags} = cli

const showName = async () => {
	return new Promise((resolve, reject) => {
		figlet("site-inspect", function (err, data) {
			if (err) {
				reject(err)
				log("Something went wrong...", 'error');
				console.dir(err);
				process.exit(1)
			}
			
			console.clear()
			console.log(orange(data))
			console.log('\n')
			resolve(data)
		});
	})
}

module.exports = async () => {
	process.on('unhandledRejection', err => {
		handleError(`UNHANDLED ERROR`, err);
	});

	if (flags.take <= 0) {
		handleError(
			'INVALID FLAG', 
			Error(`--take, -n flag can't be <= 0`)
		)
	}

	await showName()

	input.includes(`help`) && cli.showHelp(0);

};
