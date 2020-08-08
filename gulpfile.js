const walk = require('@danmasta/walk');
const gulp = require('gulp');
const Table = require('easy-table');
const _ = require('lodash');
const csv = require('./index');
const util = require('./lib/util');

gulp.task('test-stream', () => {

    return util.getCsvFileData({ size: 20 }).then(data => {

        let rows = 0;
        let start = process.hrtime();
        let bytes = 0;
        let ms = 0;

        return data.stream.pipe(csv())
            .on('data', chunk => {
                rows++;
            })
            .once('end', () => {
                ms = util.ms(start);
                bytes = Buffer.byteLength(data.str);
                util.stats({ ms, rows, bytes });
            });

    });

});

gulp.task('test-parse', () => {

    return util.getCsvFileData({ size: 20 }).then(data => {

        let start = process.hrtime();
        let res = csv.parse(data.str);
        let ms = util.ms(start);
        let rows = res.length;
        let bytes = Buffer.byteLength(data.str);

        util.stats({ ms, rows, bytes });

    });

});

gulp.task('test-buffer', () => {

    return util.getCsvFileData({ size: 20 }).then(data => {

        let start = process.hrtime();
        let res = csv.parse(data.buff);
        let ms = util.ms(start);
        let rows = res.length;
        let bytes = Buffer.byteLength(data.str);

        util.stats({ ms, rows, bytes });

    });

});

gulp.task('bench', () => {

    return walk('./tests/data', { src: '**/*.csv' }).contents().map(file => {

        let size = 0.5;

        if (/earthquakes/i.test(file.name)) {
            size = 10;
        }

        let data = util.csvDataToMbSize(file.contents, { size });
        let matches = data.match(/"|,|\r\n|\n/g).length;
        let density = util.number(matches/data.length);

        let res1 = util.average(data, {count: 10, buffer: false});
        let res2 = util.average(data, {count: 10, buffer: true});


        return[{
            file: file,
            rows: res1.rows,
            ms: res1.ms,
            bytes: Buffer.byteLength(data),
            mode: 'String',
            density
        }, {
            file: file,
            rows: res2.rows,
            ms: res2.ms,
            bytes: Buffer.byteLength(data),
            mode: 'Buffer',
            density
        }];

    }).then(res => {

        let t = new Table();

        _.map(_.flatten(res), test => {
            t.cell('Filename', test.file.name);
            t.cell('Mode', test.mode);
            t.cell('Density', test.density);
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
    let stream = util.createReadStream(util.toCharArray(data), { encoding: null });

    return stream.pipe(csv())
        .on('data', chunk => {
            res.push(chunk);
        })
        .once('end', () => {
            console.log('RES', res);
        });

});
