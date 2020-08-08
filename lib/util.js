const fs = require('fs');
const Readable = require('stream').Readable;
const path = require('path');
const walk = require('@danmasta/walk');
const _ = require('lodash');
const csv = require('../index');

const defaults = {
    csvPath: './tests/data/Earthquakes.csv',
    read: {
        randomize: false,
        buffer: false,
        encoding: 'utf8'
    },
    dataToMbSize: {
        newline: '\n',
        size: 1
    },
    average: {
        count: 10,
        buffer: false
    },
    csvData: {
        size: 10
    },
    stats: {
        ms: 0,
        rows: 0,
        bytes: 0
    }
};

// get random chunk size between 1b and 64kb
function randomByteSize () {
    let kb = 1024 * 64;
    return Math.round(Math.random() * (kb - 1) + 1);
}

function mbToBytes (mb) {
    return (1 * 1024 * 1024) * mb;
}

function csvDataToMbSize (str, opts) {

    opts = _.defaults(opts, defaults.dataToMbSize);

    let lines = [];
    let res = [];
    let headers = '';
    let first = 0;
    let size = mbToBytes(opts.size);
    let bytes = 0;
    let i = 0;

    first = str.indexOf(opts.newline);
    headers = str.slice(0, first).trim();

    lines = str.slice(first + opts.newline.length).trim().split(opts.newline);

    bytes += Buffer.byteLength(headers);
    res.push(headers);

    if (size) {
        while (bytes < size) {
            if (i > lines.length-1) {
                i = 0;
            }
            bytes += Buffer.byteLength(lines[i]);
            res.push(lines[i]);
            ++i;
        }
    } else {
        res = res.concat(lines);
    }

    return res.join(opts.newline);

}

class DataReadStream extends Readable {

    constructor (data, opts) {

        let offset = 0;
        let length = 0;

        opts = _.defaults(opts, defaults.read);

        super(opts);

        if (opts.buffer) {
            data = Buffer.from(data);
        }

        if (_.isArray(data)) {

            _.each(data, val => {
                this.push(val);
            });

        } else if (Buffer.isBuffer(data) || typeof data === 'string') {

            if (opts.randomize) {
                while (offset < data.length) {
                    length = randomByteSize();
                    this.push(data.slice(offset, offset + length));
                    offset += length;
                }
            } else {
                this.push(data);
            }

        }

        this.push(null);

    }

    _read () {

    }

}

function toCharArray (data) {

    let res = [];

    if (_.isString(data)) {
        for (let i = 0; i < data.length; i++) {
            res.push(data[i]);
        }
    } else if (Buffer.isBuffer(data)) {
        for (let i = 0; i < data.length; i++) {
            let slice = data.slice(i, i+1);
            if (slice.length) {
                res.push(slice);
            }
        }
    }

    return res;

}

function getCsvReadStream () {
    return fs.createReadStream(path.resolve(defaults.csvPath), { encoding: 'utf8' });
}

function getCsvFileContents () {
    return walk(defaults.csvPath).contents().promise().then(res => {
        return res[0].contents;
    });
}

function multiplyLines (str, factor) {
    let res = str.split('\n').slice(0, 1);
    for (let i = 0; i < factor; i++) {
        res = res.concat(str.split('\n').slice(1));
    }
    return res.join('\n');
}

function getCsvFileData (opts) {

    opts = _.defaults(opts, defaults.csvData);

    return getCsvFileContents().then(str => {
        str = csvDataToMbSize(str, {size: opts.size});
        let stream = new DataReadStream(str, opts);
        let buff = Buffer.from(str);
        return { stream, str, buff };
    });

}

function number (int) {
    return int.toLocaleString(false, { maximumFractionDigits: 2 });
}

function ms (start) {
    let diff = process.hrtime(start);
    return (diff[0] * 1000) + (diff[1] / 1000000);
}

function bps (ms, bytes) {
    return (1000/ms) * bytes;
}

function rps (ms, rows) {
    return (1000/ms) * rows;
}

function stats (opts) {

    opts = _.defaults(opts, defaults.average);

    console.log('Finished:', number(opts.ms), 'ms', '|', number(opts.rows), 'rows', '|', number(opts.bytes), 'bytes', '|', number(bps(opts.ms, opts.bytes)), 'bytes/sec', '|', number(rps(opts.ms, opts.rows)), 'rows/sec');

}

function average (str, opts) {

    let time = [];
    let rows = [];
    let start = null;
    let res = null;

    opts = _.defaults(opts, defaults.average);

    str = opts.buffer ? Buffer.from(str) : str;

    for (let i = 0; i < opts.count; i++) {
        start = process.hrtime();
        res = csv.parse(str, { buffer: opts.buffer });
        time.push(ms(start));
        rows.push(res.length);
    }

    return { ms: _.mean(time), rows: _.mean(rows) };

}

function createReadStream (data, opts) {
    return new DataReadStream(data, opts);
}

function createReadStreamObject (data, opts) {
    return new DataReadStream(data, _.assign(opts,  { objectMode: true }));
}

exports.randomByteSize = randomByteSize;
exports.createReadStream = createReadStream;
exports.createReadStreamObject = createReadStreamObject;
exports.readstream = createReadStream;
exports.readstream.obj = createReadStreamObject;
exports.toCharArray = toCharArray;
exports.getCsvReadStream = getCsvReadStream;
exports.getCsvFileContents = getCsvFileContents;
exports.multiplyLines = multiplyLines;
exports.getCsvFileData = getCsvFileData;
exports.number = number;
exports.ms = ms;
exports.bps = bps;
exports.rps = rps;
exports.stats = stats;
exports.average = average;
exports.csvDataToMbSize = csvDataToMbSize;
