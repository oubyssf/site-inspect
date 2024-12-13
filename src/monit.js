const { flags } = require("./cli");
const {deltaT} = require('./utils')
const {logLine, Logs} = require('./log')
const { monit } = flags
const START_LINE = 7;


class Workers {
    length;
    processed;
    workers = {};
    recordWorkerMap = new Map();

    constructor(length) {
        this.length = length
        this.processed = 0
        this.workers = Array(this.length).fill(null)            
    }

    _getFreeWorkerKey() {
        for (let i = 0; i < this.length; i++) {
            if(this.workers[i] === null) {
                return i
            }            
        }
        throw Error('This is not supposed to happen')
    }

    _add({key, url, status}) {
        const fwk = this._getFreeWorkerKey()
        this.workers[fwk] = {key, url, status}
        this.recordWorkerMap.set(key, fwk)
    }

    update({key, url, status}) {
        if(this.recordWorkerMap.has(key)) {
            const WorkerID = this.recordWorkerMap.get(key)
            this.workers[WorkerID] = {key, url, status}
        } else {
            this._add({key, url, status})
        }
    }

    clear() {
        for (let k = 0; k < this.length; k++) {
            const worker = this.workers[k]
            if(worker != null && worker.status === 'FINISHED'){
                ++this.processed
                this.workers[k] = null
                this.recordWorkerMap.delete(worker.key)
            }            
        }
    }

    show(x,y) {
        const START = START_LINE + y

        for(let k = 0; k < this.length; k++) {
            process.stdout.cursorTo(x, START + k);
            process.stdout.clearLine(0);
            const worker = `#${k} Worker:`;
            if(this.workers[k] === null) {
                process.stdout.write(worker)
                continue
            }

            const {key, url, status} = this.workers[k]
            process.stdout.write(`${worker} ${status} ${key} ${url}`)
        }
    }
}

class Monit {
    start;
    total;
    workers;
    logs;

    constructor(total) {
        this.start = this._now()
        this.total = total
        this.workers = new Workers(flags.batchSize)
        this.logs = new Logs()
    }

    _now() {
        return new Date()
    }

    get _processed() {
        return this.workers.processed
    }

    _remaining() {
        return this.total - this._processed
    }

    _speed() {
        const dt = this._now() - this.start
        return this._processed/dt
    }

    progress() {
        const ratio = this._processed/this.total
        return `Progress: ${this._processed}/${this.total} (${Math.round(ratio*10000)/10000}%)`
    }
    
    runningFor() {
        const dt = this._now() - this.start
        return `Running for: ${deltaT(dt)}`
    }

    now() {
        return `Now: ${this._now()}`
    }

    remaining() {
        const speed = this._speed();
        const speedinMin = Math.round(speed*600000)/10
        const timeRemaining = new Date(
            Math.round(
                (this._remaining())/speed
            )
        )
        return `Remaining: ${deltaT(timeRemaining)} ${speedinMin} pages/min`
    }

    memoryUsage() {
        const {rss, heapTotal, heapUsed, external} = process.memoryUsage()
        const RSS = `RSS: ${Math.round(rss/1000000)}MB`
        const HEAP = `Heap: ${Math.round(heapUsed/1000000)}MB/${Math.round(heapTotal/1000000)}MB (used/total)`
        return `Memory usage: ${RSS} - ${HEAP}`
    }

    monit({key, url, status}) {
        if(!monit) return

        this.workers.update({key, url, status})
        
        const lines = [
            `Start: ${this.start}`,
            this.now(),
            this.runningFor(),
            this.progress(),
            this.remaining(),
            this.memoryUsage(),
            `Workers: ${this.workers.length}`,
        ].map(s => `=== ${s}`)
        
        for (let i = 0; i < lines.length; i++) {
            process.stdout.cursorTo(0, START_LINE+i);
            process.stdout.clearLine(0)
            process.stdout.write(lines[i])
        }
        
        this.workers.show(7, lines.length);
    }

    log(message, type) {
        const line = logLine(message, type)
        if(!monit){
            console.log(line)
            return
        }

        this.logs.add(line)
        this.logs.show(4, START_LINE+flags.batchSize+8)

    }
}

module.exports = {
    Monit,
}