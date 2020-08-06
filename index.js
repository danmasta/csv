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

        this.opts = opts = _.defaults(opts, defaults);

        this.match;
        this.row = {};
        this.headers = [];
        this.pos = 0;
        this.quoted = false;
        this.offset = 0;
        this.rows = 0;
        this.slice = '';
        this.str = '';
        this.delimeter = ',';
        this.quote = '"';
        this.newline = opts.newline;
        this.decoder = new StringDecoder(opts.encoding);
        this.raw = '';

        this.line = {
            str: '',
            char: '',
            delim: 0,
            quote: 0,
            match: 0,
            min: 0,
            max: 0,
            offset: 0,
        };

        this.raw = {
            str: '',
            char: '',
            delim: 0,
            quote: 0,
            newline: 0,
            match: 0,
            min: 0,
            mid: 0,
            max: 0,
            offset: 0
        };

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

    _flushCol (index) {

        if (this.rows) {
            this._flushValue();
        } else {
            this._flushHeader();
        }

        this.pos++;
        this.slice = '';

    }

    _flushRow (index) {

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

    // append quote to string if needed
    // because we always advance offset, might miss on next match
    _handleQuote (index) {

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this.slice += this.raw.str.slice(this.raw.offset, index);
            this.raw.offset = index;
        } else {
            if (this.raw.str[this.raw.offset - 1] === '"') {
                this.slice += '"';
            }
        }

        this.raw.offset += 1;

    }

    // don't append delim if quoted, just skip
    // delims are included in string slices, so it gets picked up on next match
    _handleDelimeter (index, newline) {

        if (this.quoted) return;

        this.slice += this.raw.str.slice(this.raw.offset, index);
        this.raw.offset = index + (newline ? this.newline.length : 1);

        this._flushCol(index);

    }

    // append newline to string if quoted
    // because newlines are not included in initial slices
    _handleNewline (index) {

        if (this.quoted) return;

        this._handleDelimeter(index, true);
        this._flushRow(index);

    }

    parse (str) {

        let raw = this.raw;

        raw.delim = -1;
        raw.quote = -1;
        raw.newline = -1;
        raw.match = 0;
        raw.min = 0;
        raw.mid = 0;
        raw.max = 0;
        raw.offset = 0;

        if (this.opts.buffer) {
            raw.str += this.decoder.write(str);
        } else {
            raw.str += str;
        }

        while (raw.match != -1) {

            raw.delim = raw.delim >= raw.match ? raw.delim : raw.str.indexOf(this.delimeter, raw.match);
            raw.quote = raw.quote >= raw.match ? raw.quote : raw.str.indexOf(this.quote, raw.match);
            raw.newline = raw.newline >= raw.match ? raw.newline : raw.str.indexOf(this.newline, raw.match);
            raw.min = Math.min(raw.delim, raw.quote, raw.newline);
            raw.max = Math.max(raw.delim, raw.quote, raw.newline);
            raw.mid = (raw.delim + raw.quote + raw.newline) - raw.min - raw.max;
            raw.match = raw.min > -1 ? raw.min : raw.mid > -1 ? raw.mid : raw.max;

            if (raw.match > -1) {

                switch (raw.str[raw.match]) {
                    case ',':
                        this._handleDelimeter(raw.match);
                        raw.match++;
                        break;
                    case '"':
                        this._handleQuote(raw.match);
                        raw.match++;
                        break;
                    default:
                        this._handleNewline(raw.match);
                        raw.match += this.newline.length;
                        break;
                }

            }

        }

        if (raw.offset < raw.str.length) {
            raw.str = raw.str.slice(raw.offset);
            raw.offset = 0;
        } else {
            raw.str = '';
            raw.offset = 0;
        }

    }

    flush () {

        let raw = this.raw;

        raw.str += this.decoder.end();
        this.slice += raw.str.slice(raw.offset);

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
