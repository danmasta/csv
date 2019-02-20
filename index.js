const _ = require('lodash');
const Transform = require('stream').Transform;

const defaults = {
    headers: true,
    values: null,
    newline: '\n',
    delimeter: ',',
    quote: '"',
    cb: _.noop
};

// https://tools.ietf.org/html/rfc4180
class CsvParser {

    constructor (opts) {

        opts = _.defaults(opts, defaults);

        this.opts = opts;
        this.regex = new RegExp(`${opts.delimeter}|${opts.quote}|${opts.newline}`, 'g');
        this.match;
        this.row = {};
        this.headers = [];
        this.pos = 0;
        this.quoted = false;
        this.offset = 0;
        this.rows = 0;
        this.slice = '';
        this.str = '';
        this.delimeter = opts.delimeter;
        this.quote = opts.quote;
        this.newline = opts.newline;

        this.keys = {
            headers: CsvParser.getBooleanMap(opts.headers),
            values: CsvParser.getBooleanMap(opts.values)
        };

    }

    static getBooleanMap (obj) {

        let res = {};

        _.map(obj, (val, key) => {
            res[key] = true;
        });

        return res;

    }

    _flushCol (index, char) {

        if (this.rows) {

            this.row[this.headers[this.pos]] = this.opts.values && this.keys.values[this.slice] ? this.opts.values[this.slice] : this.slice;

        } else {

            if (!this.opts.headers) {
                this.row[this.pos] = this.opts.values && this.keys.values[this.slice] ? this.opts.values[this.slice] : this.slice;
                this.headers.push(this.pos);
            } else if (_.isBoolean(this.opts.headers)) {
                this.headers.push(this.slice);
            } else if (_.isArray(this.opts.headers)) {
                this.headers.push(this.keys.headers[this.pos] ? this.opts.headers[this.pos] : this.pos);
            } else if (_.isPlainObject(this.opts.headers)) {
                this.headers.push(this.opts.headers && this.keys.headers[this.slice] ? this.opts.headers[this.slice] : this.slice);
            }

        }

        this.pos++;
        this.slice = '';

    }

    _flushRow (index, char) {

        // we skip the first row for adding headers
        // except when headers are disabled
        if (this.rows) {
            this.opts.cb(this.row);
        } else if (!this.opts.headers) {
            this.opts.cb(this.row);
        }

        this.rows++;
        this.row = {};
        this.pos = 0;

    }

    _handleQuote (index, char) {

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this.slice += this.str.slice(this.offset, index);
            this.offset = index;
        } else {
            if (this.str[index - 1] === char) {
                this.slice += char;
            }
        }

        this.offset += char.length;

    }

    _handleDelimeter (index, char) {

        if (this.quoted) return;

        this.slice += this.str.slice(this.offset, index);
        this.offset = index + char.length;

        this._flushCol(index, char);

    }

    _handleNewline (index, char) {

        if (this.quoted) return;

        this._handleDelimeter(index, char);
        this._flushRow(index, char);

    }

    // parses a string or buffer
    //
    // in my testing, using regex.exec with a switch case was the fastest method
    // much faster than using a for loop over each character
    parse (str) {

        this.str += str;

        while (this.match = this.regex.exec(this.str)) {

            switch (this.match[0]) {
                case this.delimeter:
                    this._handleDelimeter(this.match.index, this.match[0]);
                    break;
                case this.quote:
                    this._handleQuote(this.match.index, this.match[0]);
                    break;
                case this.newline:
                    this._handleNewline(this.match.index, this.match[0]);
                    break;
            }

        }

        this.str = this.str.slice(this.offset);

    }

    flush () {

        this.slice += this.str;

        if (this.slice.length) {
            this._flushCol();
            this._flushRow();
        }

    }

}

class CsvParseStream extends Transform {

    constructor (opts) {

        super({ objectMode: true });

        opts = _.assign(opts, { cb: this.push.bind(this) });
        this.parser = new CsvParser(opts);

    }

    _transform (chunk, enc, cb) {
        this.parser.parse(chunk);
        cb(null);
    }

    _flush (cb) {
        this.parser.flush();
        cb(null);
    }

}

function parse (str, opts) {

    let res = [];

    let parser = new CsvParser(_.assign(opts, { cb: res.push.bind(res) }));

    parser.parse(str);
    parser.flush();

    return res;

}

function stream (opts) {
    return new CsvParseStream(opts);
}

function promise (str, opts) {
    return new Promise((resolve, reject) => {
        resolve(parse(str, opts));
    });
}

exports.Parser = CsvParser;
exports.parse = parse;
exports.stream = stream;
exports.promise = promise;
