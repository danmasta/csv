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

        this._prev = -1;
        this._next = -1;
        this._char = null;

    }

    _flushValue () {

        if (this.opts.values) {

            if (typeof this.opts.values === 'function') {
                this.row[this.headers[this.pos]] = this.opts.values(this.slice);
            } else {
                this.row[this.headers[this.pos]] = this.opts.values.hasOwnProperty(this.slice) ? this.opts.values[this.slice] : this.slice;
            }

        } else {
            this.row[this.headers[this.pos]] = this.slice;
        }

    }

    _flushHeader () {

        if (!this.opts.headers) {
            this.headers.push(this.pos);
            this._flushValue();

        } else if (typeof this.opts.headers === 'boolean') {
            this.headers.push(this.slice);

        } else if (Array.isArray(this.opts.headers)) {
            this.headers.push(this.opts.headers.hasOwnProperty(this.pos) ? this.opts.headers[this.pos] : this.pos);

        } else if (typeof this.opts.headers === 'object') {
            this.headers.push(this.opts.headers.hasOwnProperty(this.slice) ? this.opts.headers[this.slice] : this.slice);

        } else if (typeof this.opts.headers === 'function') {
            this.headers.push(this.opts.headers(this.slice));
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

        console.log('Handle Quote', this.quoted, this.offset)

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this.slice += this.str.slice(this.offset, index);
            this.offset = index;
        } else {
            if (this.str[index - 1] === char) {
                this.slice += char;
            }
        }

        // this.offset += char.length;
        this.offset = index + char.length;

    }

    _handleDelimeter (index, char) {

        // console.log('Handle Delimeter', index, `char: ${char.toString()}`, this.quoted, this.str.slice(0, index))
        console.log('Handle Delimeter', this.quoted, this.offset)

        if (this.quoted) {
            // this.offset++;
            this.offset = this.offset + char.length;
            // this.offset = index + char.length;
            return;
        }

        this.slice += this.str.slice(this.offset, index);
        this.offset = index + char.length;

        this._flushCol(index, char);

    }

    _handleNewline (index, char) {

        if (this.quoted) {
            // this.offset++;
            // this.offset = index + char.length;
            this.offset = this.offset + char.length;
            return;
        }

        this._handleDelimeter(index, char);
        this._flushRow(index, char);

    }

    _match () {

        let i,j,k;

        this._next = -1;

        i = this.str.indexOf(this.delimeter, this.offset);
        j = this.str.indexOf(this.quote, this.offset);
        k = this.str.indexOf(this.newline, this.offset);

        if (i > -1) {
            this._next = i, this._char = this.delimeter;
        }

        if (j > -1 && (this._next < 0 || j < this._next)) {
            this._next = j, this._char = this.quote;
        }

        if (k > -1 && (this._next < 0 || k < this._next)) {
            this._next = k, this._char = this.newline;
        }

        return this._next;

    }

    parse (str) {

        this.str += str;

        while (this._match() > -1) {

            console.log('MATCH', this._next, this._char, this.str.slice(this._next))

            switch (this._char) {
                case this.delimeter:
                    this._handleDelimeter(this._next, this._char);
                    break;
                case this.quote:
                    this._handleQuote(this._next, this._char);
                    break;
                case this.newline:
                    this._handleNewline(this._next, this._char);
                    break;
            }

        }

        if (this.offset < this.str.length-1) {
            this.str = this.str.slice(this.offset);
            this.offset = 0;
        }

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
