const path = require('path');
const chai = require('chai');
const csv = require('../index');
const util = require('../lib/util');

beforeEach(function () {
    global.path = path;
    global.assert = chai.assert;
    global.expect = chai.expect;
    global.should = chai.should();
    global.csv = csv;
    global.util = util;
});
