const spectrum = require('csv-spectrum');
const _ = require('lodash');

describe('csv-spectrum', () => {

    it('should support csv-spectrum format tests', done => {

        spectrum((err, res) => {

            if (err) {
                return done(err);
            }

            _.map(res, spec => {
                let newline = /crlf/.test(spec.name) ? '\r\n' : '\n';
                let parsed = csv.parse(spec.csv, { newline });
                let json = JSON.parse(spec.json.toString());
                expect(parsed).to.deep.equal(json);
                done();
            });

        });

    });

});
