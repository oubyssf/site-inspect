const cli = require('./cli')
const { isValidHttpUrl } = require("./utils");
const path = require('node:path')
const { readFile, fileExists } = require('./io');
const {input} = cli
const Kefir = require('kefir')
const cliHandleError = require('cli-handle-error');


const getURLStreamFromFile = async () => {
    const {inputFilePath} = validInputFile();

	const total = await readFile(inputFilePath).
        map(() => 1).
        scan((p,n) => p+n,0).
        toPromise()

    const source = () => {
        return readFile(inputFilePath)
            .skipDuplicates((a, b) => a.id == b.id)
            .skipDuplicates((a, b)=>String(a.parsedUrl)==String(b.parsedUrl))
    }

    return {source,total}
}

const getURLStreamFromArgs = () => {
    let inputUrls = input.filter(isValidHttpUrl)
    const total = inputUrls.length
    const finputUrls = inputUrls.
        map((v, i) => ({
            id: i, 
            parsedUrl: new URL(v), 
            numberOfTests: 0
        }))
    
    const source = () => {
        return Kefir
            .sequentially(0, finputUrls)
            .skipDuplicates((a,b) => a.id==b.id)
            .skipDuplicates((a, b) => String(a.parsedUrl)==String(b.parsedUrl))
    }

    if (total > 0) {
        return {source, total}
    }
    return null
}

async function getURLStream() {
    const argstream = getURLStreamFromArgs();
    if (argstream) {
        return {...argstream, fromFile: false}
    }
    
    const fileStream = await getURLStreamFromFile()
    return {...fileStream, fromFile: true}
}

const supportedExtensions = new Set(['.txt', '.csv', '.json', '.xlsx'])
const supportedFileExtension = (filePath) => {
    const extension = path.extname(filePath).toLowerCase();
    if (!supportedExtensions.has(extension)) {
        cliHandleError(
            'INPUT',
            Error(`Input file exension ${extension} is not supported`)
        )
    }
}

const validInputFile = () => {
    const inputFileName = input.length > 0 
        ? input[0] 
        : cli.flags.input
    
    if (!inputFileName) {
        cliHandleError(
            'INPUT',
            Error(`No input file provided`)
        )
    }
    
    const inputFilePath = path.join(process.cwd(), inputFileName)
    
    supportedFileExtension(inputFilePath);
    
    fileExists(inputFilePath).catch((err) => {
        cliHandleError(
            'INPUT',
            Error(err)
        )
    });

    return {inputFileName, inputFilePath}
}


module.exports = {
    getURLStream,
}