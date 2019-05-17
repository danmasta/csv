const fs = require('fs');
const Readable = require('stream').Readable;
const path = require('path');
const pw = require('@danmasta/walk');
const _ = require('lodash');
const CSV = require('../index');

const defaults = {
    csvPath: './tests/data/Earthquakes.csv',
    read: {
        randomize: false
    }
};

function random () {
    return Math.round(Math.random() * (1000 - 1) + 1);
}

class ReadStream extends Readable {

    constructor (data, opts) {

        let offset = 0;
        let length = 0;

        opts = _.defaults(opts, defaults.read);

        super(opts);

        if (_.isArray(data)) {

            _.each(data, val => {
                this.push(val);
            });

        } else if (Buffer.isBuffer(data) || typeof data === 'string') {

            if (opts.randomize) {
                length = random();
                this.push(data.slice(offset, offset + length));
                offset += length;
            } else {
                this.push(data);
            }

        }

        this.push(null);

    }

    _read() {}

}

function toCharArray (data) {

    let res = [];

    if (_.isString(data)) {
        for (let i = 0; i < data.length; i++) {
            res.push(data[i]);
        }
    } else if (Buffer.isBuffer(data)) {
        for (let i = 0; i < data.length; i++) {
            res.push(data.slice(i, i + 1));
        }
    }

    return res;

}

function getCSVReadStream () {
    return fs.createReadStream(path.resolve(defaults.csvPath));
}

function getCSVContents () {
    return pw.contents(defaults.csvPath).then(res => {
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

function getCSVData () {

    return getCSVContents().then(str => {
        str = multiplyLines(str, 10);
        let stream = new ReadStream(str);
        return { stream, str };
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

function stats (ms, rows, bytes) {
    console.log('Finished:', number(ms), 'ms', '|', number(rows), 'rows', '|', number(bytes), 'bytes', '|', number(bps(ms, bytes)), 'bytes per second', '|', number(rps(ms, rows)), 'rows per second');
}

function average (str, count) {

    let time = [];
    let rows = [];

    count = count || 10;

    for (let i = 0; i < count; i++) {
        let start = process.hrtime();
        let res = CSV.parse(str);
        time.push(ms(start));
        rows.push(res.length);
    }

    return { ms: _.mean(time), rows: _.mean(rows) };

}

function readStream (...args) {
    return new ReadStream(...args);
}

function readStreamObject (data, opts) {
    opts = _.assign(opts,  { objectMode: true });
    return new ReadStream(data, opts);
}

exports.random = random;
exports.readstream = readStream;
exports.readstream.obj = readStreamObject;
exports.toCharArray = toCharArray;
exports.getCSVReadStream = getCSVReadStream;
exports.getCSVContents = getCSVContents;
exports.multiplyLines = multiplyLines;
exports.getCSVData = getCSVData;
exports.number = number;
exports.ms = ms;
exports.bps = bps;
exports.rps = rps;
exports.stats = stats;
exports.average = average;
