const _ = require('lodash');

describe('parse', () => {

    it('should accurately parse rows', () => {

        return util.getCSVData().then(data => {

            let res = csv.parse(data.str);

            expect(_.isEqual(res[0], {
                time: '2015-12-22T18:45:11.000Z',
                latitude: '59.9988',
                longitude: '-152.7191',
                depth: '100',
                mag: '3',
                magType: 'ml',
                nst: '',
                gap: '',
                dmin: '',
                rms: '0.54',
                net: 'ak',
                id: 'ak12293661',
                updated: '2015-12-22T19:09:29.736Z',
                place: '54km S of Redoubt Volcano, Alaska',
                type: 'earthquake'
            }));
            expect(_.isEqual(res[1], {
                time: '2015-12-22T18:38:34.000Z',
                latitude: '62.9616',
                longitude: '-148.7532',
                depth: '65.4',
                mag: '1.9',
                magType: 'ml',
                nst: '',
                gap: '',
                dmin: '',
                rms: '0.51',
                net: 'ak',
                id: 'ak12293651',
                updated: '2015-12-22T18:47:23.287Z',
                place: '48km SSE of Cantwell, Alaska',
                type: 'earthquake'
            }));
            expect(_.isEqual(res[res.length-2], {
                time: '2015-11-22T19:29:30.970Z',
                latitude: '35.1063333',
                longitude: '-119.1393333',
                depth: '1.54',
                mag: '1.43',
                magType: 'ml',
                nst: '15',
                gap: '108',
                dmin: '0.233',
                rms: '0.18',
                net: 'ci',
                id: 'ci37276359',
                updated: '2015-11-23T20:02:41.084Z',
                place: '24km ENE of Maricopa, California',
                type: 'earthquake'
            }));
            expect(_.isEqual(res[res.length-1], {
                time: '2015-11-22T19:21:49.000Z',
                latitude: '62.3112',
                longitude: '-151.4538',
                depth: '90',
                mag: '1.7',
                magType: 'ml',
                nst: '',
                gap: '',
                dmin: '',
                rms: '0.34',
                net: 'ak',
                id: 'ak12036678',
                updated: '2015-11-30T22:36:02.927Z',
                place: '69km W of Talkeetna, Alaska',
                type: 'earthquake'
            }));

        });

    });

});
