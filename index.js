const Transform = require('stream').Transform;
const StringDecoder = require('string_decoder').StringDecoder;
const _ = require('lodash');

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

        this.raw = {
            str: '',
            match: 0,
            offset: 0
        };

        this.line = {
            str: '',
            match: 0,
            min: 0,
            max: 0,
            offset: 0,
        };

        this.delim = {
            char: ',',
            match: -1,
            next: -1
        };

        this.quote = {
            char: '"',
            match: -1,
            next: -1
        };

        this.newline = {
            char: opts.newline,
            match: -1,
            next: -1
        };

    }

    _flushValue () {

        let slice = this.slice;
        let opts = this.opts;
        let headers = this.headers;

        if (opts.values) {

            if (typeof opts.values === 'function') {
                this.row[headers[this.pos]] = opts.values(slice, headers[this.pos]);
            } else {
                this.row[headers[this.pos]] = opts.values.hasOwnProperty(slice) ? opts.values[slice] : slice;
            }

        } else {
            this.row[headers[this.pos]] = slice;
        }

    }

    _flushHeader () {

        let slice = this.slice;
        let opts = this.opts;
        let headers = this.headers;
        let type = typeof opts.headers;

        if (!opts.headers) {

            headers.push(this.pos);
            this._flushValue();

        } else if (type === 'boolean') {

            headers.push(slice);

        } else if (Array.isArray(opts.headers)) {

            headers.push(opts.headers.hasOwnProperty(this.pos) ? opts.headers[this.pos] : this.pos);

        } else if (type === 'object') {

            headers.push(opts.headers.hasOwnProperty(slice) ? opts.headers[slice] : slice);

        } else if (type === 'function') {

            headers.push(opts.headers(slice));

        }

    }

    _flushCol () {

        if (this.rows) {
            this._flushValue();
        } else {
            this._flushHeader();
        }

        this.pos++;
        this.slice = '';

    }

    _flushRow () {

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

    _flushSlice (index) {
        this.slice += this.line.str.slice(this.line.offset, index);
    }

    // append quote to string if needed
    // we always advance offset, so might miss on next match
    _handleQuote (index) {

        let line = this.line;
        let delim = this.delim;
        let quote = this.quote;

        // set next match
        quote.match = quote.next;
        quote.next = line.str.indexOf(quote.char, index + 1);

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this._flushSlice(index);
            line.offset = index;
        } else {
            if (line.str[index - 1] === '"') {
                this.slice += '"';
            }
        }

        line.offset++;

        // shortcut
        if (delim.next === -1 && quote.next > -1) {
            this._handleQuote(quote.next);

        // handle next match
        } else if (delim.next > -1) {
            if (quote.next > -1 && (quote.next < delim.next)) {
                this._handleQuote(quote.next);
            } else {
                this._handleDelimeter(delim.next);
            }
        }

    }

    // don't append delim if quoted, just skip
    // delims are included in string slices, so it gets picked up on next match
    _handleDelimeter (index) {

        let line = this.line;
        let delim = this.delim;
        let quote = this.quote;

        // set next match
        delim.match = delim.next;
        delim.next = line.str.indexOf(delim.char, index + 1);

        if (!this.quoted) {
            this._flushSlice(index);
            line.offset = index + 1;
            this._flushCol(index);
        }

        // shortcut
        if (quote.next === -1 && delim.next > -1) {
            this._handleDelimeter(delim.next);

        // handle next match
        } else if (quote.next > -1) {
            if (delim.next > -1 && (delim.next < quote.next)) {
                this._handleDelimeter(delim.next);
            } else {
                this._handleQuote(quote.next);
            }
        }

    }

    // append newline to string if quoted
    // because newlines are not included in initial slices
    _handleNewline (index) {

        if (this.quoted) {
            this.line.str += this.newline.char;
        } else {
            this._flushSlice(index);
            this.line.offset = index + this.newline.char.length;
            this._flushCol(index);
            this._flushRow(index);
        }

    }

    _handleLine (str) {

        let line = this.line;
        let delim = this.delim;
        let quote = this.quote;

        line.match = 0;
        line.min = 0;
        line.max = 0;
        line.str += str;

        delim.next = line.str.indexOf(delim.char, 0);
        quote.next = line.str.indexOf(quote.char, 0);

        line.min = Math.min(delim.next, quote.next);
        line.max = Math.max(delim.next, quote.next);

        line.match = line.min > -1 ? line.min : line.max;

        switch (line.str[line.match]) {
            case ',':
                this._handleDelimeter(line.match);
                break;
            case '"':
                this._handleQuote(line.match);
                break;
        }

        this._handleNewline(line.str.length);

        if (line.offset < line.str.length) {
            line.str = line.str.slice(line.offset);
            line.offset = 0;
        } else {
            line.str = '';
            line.offset = 0;
        }

    }

    parse (str) {

        let raw = this.raw;

        raw.match = 0;
        raw.offset = 0;

        if (this.opts.buffer) {
            raw.str += this.decoder.write(str);
        } else {
            raw.str += str;
        }

        while (raw.match != -1) {

            raw.offset = raw.match;
            raw.match = raw.str.indexOf(this.newline.char, raw.match);

            if (raw.match > -1) {
                this._handleLine(raw.str.slice(raw.offset, raw.match));
                raw.match += this.newline.char.length;
            }

        }

        if (raw.offset < raw.str.length) {
            raw.str = raw.str.slice(raw.offset);
        } else {
            raw.str = '';
        }

    }

    flush () {

        this.raw.str += this.decoder.end();

        if (this.raw.str.length) {
            this._handleLine(this.raw.str);
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
