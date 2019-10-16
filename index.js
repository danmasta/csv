const _ = require('lodash');
const Transform = require('stream').Transform;
const StringDecoder = require('string_decoder').StringDecoder;

const defaults = {
    headers: true,
    values: null,
    newline: '\n',
    delimeter: ',',
    quote: '"',
    cb: _.noop,
    buffer: false,
    encoding: 'utf8'
};

// https://tools.ietf.org/html/rfc4180
class CsvParser {

    constructor (opts) {

        opts = _.defaults(opts, defaults);

        this.opts = opts;
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
        this.decoder = new StringDecoder(opts.encoding);

        this._prevIndex = -1;
        this._prevChar = '';
        this._nextIndex = -1;
        this._nextChar = '';

        this.regex = new RegExp(`${opts.delimeter}|${opts.quote}|${opts.newline}`, 'g');

    }

    _flushValue () {

        let slice = this.slice;

        if (this.opts.values) {

            if (typeof this.opts.values === 'function') {
                this.row[this.headers[this.pos]] = this.opts.values(slice, this.headers[this.pos]);
            } else {
                this.row[this.headers[this.pos]] = this.opts.values.hasOwnProperty(slice) ? this.opts.values[slice] : slice;
            }

        } else {
            this.row[this.headers[this.pos]] = slice;
        }

    }

    _flushHeader () {

        let slice = this.slice;

        if (!this.opts.headers) {

            this.headers.push(this.pos);
            this._flushValue();

        } else if (typeof this.opts.headers === 'boolean') {

            this.headers.push(slice);

        } else if (Array.isArray(this.opts.headers)) {

            this.headers.push(this.opts.headers.hasOwnProperty(this.pos) ? this.opts.headers[this.pos] : this.pos);

        } else if (typeof this.opts.headers === 'object') {

            this.headers.push(this.opts.headers.hasOwnProperty(slice) ? this.opts.headers[slice] : slice);

        } else if (typeof this.opts.headers === 'function') {

            this.headers.push(this.opts.headers(slice));

        }

    }

    _flushCol (index, char) {

        if (this.rows) {
            this._flushValue();
        } else {
            this._flushHeader();
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
            if (char === this._prevChar && index - char.length === this._prevIndex) {
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

    _match () {

        this._prevIndex = this._nextIndex;
        this._prevChar = this._nextChar;

        let offset = this._prevIndex + this._prevChar.length;

        offset = offset > -1 ? offset : this.offset;

        let i = this.str.indexOf(this.delimeter, offset);
        let j = this.str.indexOf(this.quote, offset);
        let k = this.str.indexOf(this.newline, offset);

        let next = Math.min(i > -1 ? i : Infinity, j > -1 ? j : Infinity, k > -1 ? k : Infinity);

        if (next !== Infinity) {
            this._nextIndex = next;
            this._nextChar = next === i ? this.delimeter : next === j ? this.quote : this.newline;
        } else {
            this._nextIndex = -1;
            this._nextChar = '';
        }

        return this._nextIndex;

    }

    parse (str) {

        let match;

        // handle buffers and strings
        if (this.opts.buffer) {
            this.str += this.decoder.write(str);
        } else {
            this.str += str;
        }

        while ((match = this.regex.exec(this.str)) !== null) {

            this._prevChar = this._nextChar;
            this._prevIndex = this._nextIndex;
            this._nextChar = match[0];
            this._nextIndex = match.index;

            switch (match[0]) {
                case this.delimeter:
                    this._handleDelimeter(match.index, match[0]);
                    break;
                case this.quote:
                    this._handleQuote(match.index, match[0]);
                    break;
                case this.newline:
                    this._handleNewline(match.index, match[0]);
                    break;
            }

        }

        this._nextIndex = -1;
        this._nextChar = '';


        if (this.offset < this.str.length - 1) {
            this.str = this.str.slice(this.offset);
            this.offset = 0;
        }

    }

    flush () {

        this.str += this.decoder.end();
        this.slice += this.str.slice(this.offset);

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
        this.init = false;

    }

    _transform (chunk, enc, cb) {

        // detect buffer or string mode on first chunk
        // detect encoding on first chunk
        if (!this.init) {
            if (Buffer.isBuffer(chunk)) {
                this.parser.opts.buffer = true;
            } else {
                this.parser.opts.buffer = false;
            }
            if (enc !== this.parser.opts.encoding) {
                this.parser.decoder = new StringDecoder(enc);
            }
            this.parser.opts.encoding = enc;
            this.init = true;
        }

        try {
            this.parser.parse(chunk);
        } catch (err) {
            cb(err);
        }

        cb(null);

    }

    _flush (cb) {
        try {
            this.parser.flush();
        } catch (err) {
            cb(err);
        }
        cb(null);
    }

}

// buffers are coerced to strings by default
// if you want to parse in buffer mode, set: { buffer: true }
function parse (str, opts) {

    let res = [];
    let parser = new CsvParser(_.assign(opts, { cb: res.push.bind(res), buffer: Buffer.isBuffer(str) }));

    parser.parse(str);
    parser.flush();

    return res;

}

function stream (opts) {
    return new CsvParseStream(opts);
}

function promise (str, opts) {
    return new Promise((resolve, reject) => {
        try {
            resolve(parse(str, opts));
        } catch (err) {
            reject(err);
        }
    });
}

exports.Parser = CsvParser;
exports.parse = parse;
exports.stream = stream;
exports.promise = promise;
