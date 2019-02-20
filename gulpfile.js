const fs = require('fs');
const Readable = require('stream').Readable;
const path = require('path');
const pw = require('@danmasta/walk');
const gulp = require('gulp');
const Table = require('easy-table');
const _ = require('lodash');
const CSV = require('./index');

class StrStream extends Readable {

    constructor(str) {
        super();
        this.push(str);
        this.push(null);
    }

    _read() {}

}

let csvPath = './test/data/Earthquakes.csv';

function getCSVReadStream() {
    return fs.createReadStream(path.resolve(csvPath));
}

function getCSVContents() {
    return pw.contents(csvPath).then(res => {
        return res[0].contents;
    });
}

function multiplyLines(str, factor) {
    let res = str.split('\n').slice(0, 1);
    for (let i = 0; i < factor; i++) {
        res = res.concat(str.split('\n').slice(1));
    }
    return res.join('\n');
}

function getCSVData() {

    return getCSVContents().then(str => {
        str = multiplyLines(str, 10);
        let stream = new StrStream(str);
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

function stats(ms, rows, bytes) {
    console.log('Finished:', number(ms), 'ms', '|', number(rows), 'rows', '|', number(bytes), 'bytes', '|', number(bps(ms, bytes)), 'bytes per second', '|', number(rps(ms, rows)), 'rows per second');
}

gulp.task('test-stream', () => {

    return getCSVData().then(data => {

        let count = 0;
        let start = process.hrtime();

        return data.stream.pipe(CSV.stream())
            .on('data', chunk => {
                count++;
            })
            .once('end', () => {
                stats(ms(start), count, Buffer.byteLength(data.str));
            });

    });

});

gulp.task('test-parse', () => {

    return getCSVData().then(data => {

        let start = process.hrtime();
        let res = CSV.parse(data.str);

        stats(ms(start), res.length, Buffer.byteLength(data.str));

    });

});

gulp.task('bench', () => {

    return pw.contents('./test/data', { src: '**/*.csv' }).map(file => {

        return new Promise((resolve, reject) => {

            let contents = multiplyLines(file.contents, 10);
            let start = process.hrtime();
            let res = CSV.parse(contents);

            resolve({
                file: file,
                rows: res,
                ms: ms(start),
                bytes: Buffer.byteLength(contents)
            });

        });

    }).then(res => {

        let t = new Table();

        _.map(res, test => {
            t.cell('Filename', test.file.name);
            t.cell('Rows', test.rows.length);
            t.cell('Bytes', number(test.bytes));
            t.cell('Time', test.ms);
            t.cell('Rows/Sec', number(rps(test.ms, test.rows.length)));
            t.cell('Bytes/Sec', number(bps(test.ms, test.bytes)));
            t.newRow();
        });

        console.log('\n' + t.toString());

    });

});
