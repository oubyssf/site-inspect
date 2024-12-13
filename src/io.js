const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const readline = require('readline')
const jsonfile = require('jsonfile');
const xlsx = require('xlsx');
const Kefir = require('kefir');
const { access, constants } = require('node:fs');
const util = require('util');
const {isValidHttpUrl} = require('./utils')
const { flags, input } = require('./cli');
const { keyC, addrC, notC, delimiter } = flags;


const fileExists = async (path) => {
     return new Promise((res, rej) => {
         access(path, constants.F_OK, (err) => {
             if (err) {
                 res(false)
             }
             res(true)
         });
     })
}

const writeToCSV = (outputPath) => {
     let first = true
     return (data) => {
          let csvLine;
          if(first) {
               csvLine = [
                    Object.keys(data), 
                    Object.values(data)
               ]
               first = false
          } else {
               csvLine = [Object.values(data)];
          }

          fs.appendFile(
               outputPath, 
               stringify(csvLine, { 
                    delimiter,
                    record_delimiter: '\r\n',
                    cast: { 
                         boolean: (v) => v.toString(), 
                         date: (v) => v.toISOString(),
                         number: (v) => v.toString(),
                         string: (v) => v.replaceAll(/[\r\n]/gm, ' | ').replaceAll(delimiter, '')
                    } 
               }), 
               'utf8', 
               (error) => {
                    if (error) {
                         console.error('Error writing to CSV file:', error);
                    }
               }
          );
          
     };
}

const writeToTXT = (outputPath) => {
     return (data) => {
          fs.appendFile(outputPath, data.toString() + '\n', 'utf8', (error) => {
               if (error) {
                    console.error('Error writing to CSV file:', error);
               }
          });
          
     };
}

const writeToFile = (filename, data) => {
     const extension = path.extname(filename);
   
     if (extension === '.json') {
          return writeJSONFile(filename).flatMap(() => Kefir.once(data));
     } else if (extension === '.csv') {
          return writeCSVFile(filename).flatMap(() => Kefir.once(data));
     } else if (extension === '.xlsx') {
          return writeXLSXFile(filename).flatMap(() => Kefir.once(data));
     } else {
          return Kefir.once(new Kefir.Error(`Unsupported file format: ${extension}`));
     }
}

const readInput = (input) => {
     return Kefir.sequentially(
          0,
          input.
          filter(isValidHttpUrl).
          map((v, i) => ({
               id: i, 
               parsedUrl: new URL(v), 
               numberOfTests: 0
          }))
     )
}

const readTXTFile = (filepath) => {
     const inputStream = fs.
          createReadStream(filepath, {
               encoding: 'utf-8',
          });

     const rl = readline.
          createInterface({ input: inputStream });
     
     let counter = 0;
     return Kefir.
          stream((emitter) => {
               rl.on('line', emitter.emit)
               rl.on('close', emitter.end)
          }).
          filter(isValidHttpUrl).
          map(l => ({
               id: ++counter,
               parsedUrl: new URL(l),
               numberOfTests: 0
          }))
}

const formatInput = (r) => {
     let numberOfTests = Object.keys(r).includes(notC) ? Number(r[notC]) : 0;
     return {
          id: r[keyC],
          parsedUrl: new URL(r[addrC]),
          numberOfTests
     }
}

const {parse} = require('csv-parse')
const readCSVFile = (filepath) => {
     const inputStream = fs.
          createReadStream(filepath, {
               encoding: 'utf-8',
          }).pipe(parse({
               columns: true,
               delimiter: flags.delimiter,
          }));
     
     return Kefir.
          stream((emitter) => {
               inputStream.on('data', emitter.emit)
               inputStream.on('close', emitter.end)
          }).
          filter(r => isValidHttpUrl(r[addrC])).
          map(formatInput)
}

const readXLSXFile = (filePath) => {
     const workbook = xlsx.readFile(filePath);
     const worksheet = workbook.Sheets[workbook.SheetNames[0]];
     const data = xlsx.utils.
          sheet_to_json(worksheet, { header: 1 });
     
     const columns = data.
          shift().
          map( c => 
               c.toLowerCase().replace(/\s+/, '')
          )

     return Kefir.
          sequentially(0, data).
          filter(values => { 
               const addr = values[columns.indexOf(addrC.toLowerCase())]
               return isValidHttpUrl(addr)
          }).
          map(values => {
               const id = values[columns.indexOf(keyC.toLowerCase())]
               const addr = values[columns.indexOf(addrC.toLowerCase())]
               const numberOfTests = Number(values[columns.indexOf(notC.toLowerCase())]) || 0
               
               return {
                    id,
                    parsedUrl: new URL(addr),
                    numberOfTests
               }
          })    
     
}

const readJSONFile = (filePath, options = {}) => {
     return Kefir.once(filePath).
          flatMapLatest((path) => {
               return Kefir.fromBinder((sink) => {
                    jsonfile.readFile(path, options, (err, data) => {
                         if (err) {
                              sink(new Kefir.Error(err));
                         } else {
                              data.forEach((obj) => {
                                   sink(new Kefir.Next(obj));
                              });
                              sink(new Kefir.End());
                         }
                    });
          });
     }).
     filter(v => isValidHttpUrl(v[addrC])).
     map(record => ({
          id: record[keyC],
          url: record[addrC],
          numberOfTests: Number(record[notC]),
     }))
}

const readFile = (filePath) => {
     const extension = path.extname(filePath).toLowerCase();
     switch (extension) {
          case '.csv':
               return readCSVFile(filePath);
          case '.txt':
               return readTXTFile(filePath);
          default:
               return Kefir.constantError(`Unknown file extension ${extension}`);
     }
}


async function handleExistingOutputFile(oFileName, oFilePath) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const question = util.promisify(rl.question).bind(rl);
     console.clear()
	console.log(`Warning: A file named ${oFileName} already exists in the current directory.`)
	const choice = await question("Do you want to overwrite it? (yes/no):")
	if(!['yes', 'y'].includes(choice.trim().toLowerCase())){
		console.log("Operation canceled. Please choose a different output file name.")
		process.exit(1)
	} else {
		fs.unlinkSync(oFilePath)
	}
}


async function validateOutputFile() {
	const oFileName = input[1] || flags.output
	const oFilePath = path.join(process.cwd(), oFileName)
	const oFileExists = await fileExists(oFilePath)
	if(oFileExists){
		await handleExistingOutputFile(oFileName, oFilePath)
	}

	return writeToCSV(oFilePath)
}


module.exports = {
     writeToFile,
     writeToCSV,
     writeToTXT,
     readFile,
     readInput,
     readTXTFile,
     readXLSXFile,
     fileExists,
     validateOutputFile
}