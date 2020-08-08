const Parser = require('./lib/parser');

module.exports = exports = Parser.factory();
exports.Parser = Parser;
exports.parse = Parser.parse;
