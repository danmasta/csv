const pw = require('@danmasta/walk');
const gulp = require('gulp');
const Table = require('easy-table');
const _ = require('lodash');
const CSV = require('./index');
const util = require('./lib/util');

gulp.task('test-stream', () => {

    return util.getCSVData().then(data => {

        let count = 0;
        let start = process.hrtime();

        return data.stream.pipe(CSV.stream())
            .on('data', chunk => {
                count++;
            })
            .once('end', () => {
                util.stats(util.ms(start), count, Buffer.byteLength(data.str));
            });

    });

});

gulp.task('test-parse', () => {

    return util.getCSVData().then(data => {

        let start = process.hrtime();
        let res = CSV.parse(data.str);

        util.stats(util.ms(start), res.length, Buffer.byteLength(data.str));

    });

});

gulp.task('test-buffer', () => {

    return util.getCSVData().then(data => {

        let start = process.hrtime();
        let res = CSV.parse(data.buff);

        util.stats(util.ms(start), res.length, Buffer.byteLength(data.str));

    });

});

gulp.task('bench', () => {

    return pw.contents('./tests/data/Earthquakes.csv', { src: '**/*.csv' }).map(file => {

        let contents = util.multiplyLines(file.contents, 10);
        let res = util.average(contents, 10);

        return({
            file: file,
            rows: res.rows,
            ms: res.ms,
            bytes: Buffer.byteLength(contents)
        });

    }).then(res => {

        let t = new Table();

        _.map(res, test => {
            t.cell('Filename', test.file.name);
            t.cell('Rows', util.number(test.rows));
            t.cell('Bytes', util.number(test.bytes));
            t.cell('Time (ms)', util.number(test.ms));
            t.cell('Rows/Sec', util.number(util.rps(test.ms, test.rows)));
            t.cell('Bytes/Sec', util.number(util.bps(test.ms, test.bytes)));
            t.newRow();
        });

        console.log('\n' + t.toString());

    });

});

gulp.task('test-multibyte-chars', () => {

    let res = [];
    let data = Buffer.from(`col0,col1,col2\né,£,€`);
    let stream = util.readstream(util.toCharArray(data), { encoding: null });

    return stream.pipe(CSV.stream())
        .on('data', chunk => {
            res.push(chunk);
        })
        .once('end', () => {
            console.log('RES', res);
        });

});
