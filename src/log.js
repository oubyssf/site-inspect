const chalk = require('chalk')
const fs = require('fs');
const path = require('path')
const { flags } = require('./cli')




const appendToLogFile = (logline) => {
	if (flags.saveLogs){
		fs.appendFileSync(path.join(process.cwd(), 'logs.txt'), logline+'\n')
	}
}

const D = {
	'info': chalk.blue,
	'error': chalk.red,
	'success': chalk.green,
	'warning': chalk.hex('#FFFF00'),
}

const logLine = (message, type='info') => {
	const strmsg = typeof message == 'string'
	const {msg, record} = !strmsg && message
	const now = new Date() 

	const parts = [
		{
			name: 'timestamp',
			value: `[${now.toISOString()}]`,
			style: chalk.gray 
		},
		{
			name: 'type',
			value: '['+type.toUpperCase()+']',
			style: D[type]
		},
		{
			name: 'message',
			value: strmsg ? message : msg,
			style: null
		},
		{
			name: 'record.id',
			value: !strmsg && `#${record.id}`,
			style: chalk.gray
		},
		{
			name: 'record.parsedUrl',
			value: !strmsg && String(record.parsedUrl),
			style: chalk.gray
		},
		{
			name: 'record.error',
			value: !strmsg && record.error && type=='error' && `- ${record.error.message.split('\n')[0]}`,
			style: null
		}
	].filter(v => v.value)

	const rawLogline = parts.map(({value})=>value).join(' ')
	const styledLogline = parts
		.map(({value, style}) => {
			if(style) return style(value)
			return value
		})
		.join(' ')

	appendToLogFile(rawLogline)
	return styledLogline
};



class Logs {
	length;
	lines;
	showen=false;
	WIDTH=100

	constructor(length=15) {
		this.length = length
		this.lines = []
	}

	_init(x,y) {
		let title = '=== LOGS '
		for (let i = 0; i < this.WIDTH; i++) {
			title += '='			
		}
		title = chalk.hex('#FFA500').bold(title);
		process.stdout.cursorTo(x,y)
		process.stdout.clearLine(0)
		process.stdout.write(title)
	}

	_footer(x,y){
		let footer = `=========`
		for (let i = 0; i < this.WIDTH; i++) {
			footer += '=';
		}
		footer = chalk.hex('#FFA500').bold(footer)
		process.stdout.cursorTo(x,y)
		process.stdout.clearLine(0)
		process.stdout.write(footer)
	}

	add(line) {
		this.lines.push(line)
		if (this.lines.length >= this.length){
			this.lines.shift()
		}
	}

	show(x, y) {
		if(!this.showen){
			this._init(0, y)
			this._footer(0, y+this.length+2)
			this.showen = true
		}

		for (let i = 0; i < this.lines.length; i++) {
			process.stdout.cursorTo(x,y+i+2)
			process.stdout.clearLine(0)
			process.stdout.write(this.lines[i])	 			
		}
	}
}


module.exports = {
	logLine,
	Logs,
}