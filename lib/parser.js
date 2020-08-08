const Transform = require('stream').Transform;
const StringDecoder = require('string_decoder').StringDecoder;
const _ = require('lodash');

const defaults = {
    headers: true,
    values: null,
    newline: '\n',
    delimeter: ',',
    quote: '"',
    cb: undefined,
    buffer: false,
    encoding: 'utf8',
    stream: {
        objectMode: true,
        encoding: null
    },
    collect: false,
    res: undefined
};

// https://tools.ietf.org/html/rfc4180
class CsvParser extends Transform {

    constructor (opts, str) {

        if (!_.isPlainObject(opts)) {
            [opts, str] = [str, opts];
        }

        opts = _.defaults(opts, defaults);

        super(opts.stream);

        this.opts = opts;
        this.row = {};
        this.headers = [];
        this.pos = 0;
        this.quoted = false;
        this.rows = 0;
        this.slice = '';
        this.decoder = new StringDecoder(opts.encoding);
        this.init = false;
        this.res = _.isArray(opts.res) ? opts.res : [];

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

        if (_.isFunction(opts.cb)) {
            this.cb = opts.cb;
        } else {
            if (opts.collect) {
                this.cb = this.res.push.bind(this.res);
            } else {
                this.cb = this.push.bind(this);
            }
        }

        if (str) {
            this.write(str);
        }

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
            this.cb(this.row);
        } else if (!this.opts.headers) {
            this.cb(this.row);
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

        return this;

    }

    flush () {

        this.raw.str += this.decoder.end();

        if (this.raw.str.length) {
            this._handleLine(this.raw.str);
        }

        this.raw.str = '';
        this.raw.offset = 0;

        return this;

    }

    _transform (chunk, enc, cb) {

        if (!this.init) {
            if (enc) {
                this.decoder = new StringDecoder(enc);
                this.opts.encoding = enc;
            }
            this.opts.buffer = Buffer.isBuffer(chunk);
            this.init = true;
        }

        try {
            this.parse(chunk);
            cb();
        } catch (err) {
            cb(err);
        }

    }

    _flush (cb) {

        try {
            this.flush();
            cb();
        } catch (err) {
            cb(err);
        }

    }

    iterateAsPromise (fn, collect) {

        return new Promise((resolve, reject) => {

            this.on('data', row => {
                if (fn) {
                    row = fn(row);
                }
                if (collect) {
                    this.res.push(row);
                }
            });

            this.once('end', () => {
                if (collect) {
                    resolve(this.res);
                } else {
                    resolve();
                }
            });

            this.once('error', err => {
                reject(err);
            });

            if (this._readableState.pipes === null) {
                this.end();
            }

        });

    }

    map (fn) {
        fn = _.isFunction(fn) ? fn : row => row;
        return this.iterateAsPromise(fn, true);
    }

    each (fn) {
        fn = _.isFunction(fn) ? fn : _.noop;
        return this.iterateAsPromise(fn, false);
    }

    promise () {
        return this.iterateAsPromise(null, true);
    }

    static create (...args) {
        let Fn = this;
        return new Fn(...args);
    }

    static factory () {
        let Fn = this;
        return function csvFactory (...args) {
            return new Fn(...args);
        };
    }

    static parse (str, opts) {

        if (_.isPlainObject(str)) {
            [str, opts] = [opts, str];
        }

        let csv = new CsvParser(_.assign(opts, {
            collect: true,
            buffer: Buffer.isBuffer(str)
        }));

        csv.parse(str).flush();

        return csv.res;

    }

}

module.exports = CsvParser;
