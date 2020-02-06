const _ = require('lodash');

describe('chunk-boundaries', () => {

    it('should accurately handle matches across chunk boundaries', done => {

        let data = `col0,col1,col2,col3,col4\n0,"""1""",2,3"","4"`;
        let stream = util.readstream(util.toCharArray(data), { encoding: null });
        let res = [];

        return stream.pipe(csv.stream())
            .on('data', chunk => {
                res.push(chunk);
            })
            .once('end', () => {
                expect(_.isEqual(res, [ { col0: '0', col1: '"1"', col2: '2', col3: '3"', col4: '4' } ]));
                done();
            });

    });

});
