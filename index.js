const Transform = require('stream').Transform;
const StringDecoder = require('string_decoder').StringDecoder;
const _ = require('lodash');

const defaults = {
    headers: true,
    values: null,
    newline: 'lf',
    delimeter: ',',
    quote: '"',
    cb: _.noop,
    buffer: false,
    encoding: 'utf8'
};

const constants = {

    // https://en.wikipedia.org/wiki/Newline
    NEWLINE: {
        lf: '\n',
        lfcr: '\n\r',
        cr: '\r',
        crlf: '\r\n'
    }
};

function getNewlineMatch (type) {

    switch (type) {

        case 'lf':
        case 'lfcr':
            return constants.NEWLINE.lf;

        case 'cr':
        case 'crlf':
            return constants.NEWLINE.cr;

    }

}

function getNewlineHandler (type) {

    switch (type) {

        case 'lf':
        case 'cr': return function _handleNewline (index, char, prev, next) {

            if (this.quoted) return;

            this._handleDelimeter(index, char, prev, next);
            this._flushRow(index, char);

        };

        case 'lfcr': return function _handleNewline (index, char, prev, next) {

            if (this.quoted) return;

            if (next === constants.NEWLINE.cr) {
                char = constants.NEWLINE.lfcr;
            } else {
                return;
            }

            this._handleDelimeter(index, char, prev, next);
            this._flushRow(index, char);

        };

        case 'crlf': return function _handleNewline (index, char, prev, next) {

            if (this.quoted) return;

            if (next === constants.NEWLINE.lf) {
                char = constants.NEWLINE.crlf;
            } else {
                return;
            }

            this._handleDelimeter(index, char, prev, next);
            this._flushRow(index, char);

        };

    }

}

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
        this.newline = getNewlineMatch(opts.newline);
        this.decoder = new StringDecoder(opts.encoding);

        if (!constants.NEWLINE[this.opts.newline]) {
            throw new Error('CSV: Newline type not supported');
        }

        this._handleNewline = getNewlineHandler(this.opts.newline);

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

    _handleQuote (index, char, prev, next) {

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this.slice += this.str.slice(this.offset, index);
            this.offset = index;
        } else {
            if (prev === char) {
                this.slice += char;
            }
        }

        this.offset += char.length;

    }

    _handleDelimeter (index, char, prev, next) {

        if (this.quoted) return;

        this.slice += this.str.slice(this.offset, index);
        this.offset = index + char.length;

        this._flushCol(index, char);

    }

    parse (str) {

        // handle buffers and strings
        if (this.opts.buffer) {
            this.str += this.decoder.write(str);
        } else {
            this.str += str;
        }

        if (this.offset > 0) {
            this.offset = this.offset - 1;
        }

        for (let i = this.offset, char; i < this.str.length; i++) {

            char = this.str[i];

            switch (char) {
                case this.delimeter:
                    this._handleDelimeter(i, char, this.str[i-1], this.str[i+1]);
                    break;
                case this.quote:
                    this._handleQuote(i, char, this.str[i-1], this.str[i+1]);
                    break;
                case this.newline:
                    this._handleNewline(i, char, this.str[i-1], this.str[i+1]);
                    break;
            }

        }

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
