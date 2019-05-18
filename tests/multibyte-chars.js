const _ = require('lodash');

describe('multibyte-chars', () => {

    it('should accurately parse multibyte characters across chunk boundaries', done => {

        let data = Buffer.from(`col0,col1,col2\né,£,€`);
        let stream = util.readstream(util.toCharArray(data), { encoding: null });
        let res = [];

        return stream.pipe(csv.stream())
            .on('data', chunk => {
                res.push(chunk);
            })
            .once('end', () => {
                expect(_.isEqual(res, [ { col0: 'é', col1: '£', col2: '€' } ]));
                done();
            });

    });

});
