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

// class Row {
//     constructor (headers) {
//         _.each(headers, key => {
//             this[key] = '';
//         });
//     }
// }

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
        // this.obj = {};

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
            match: 0,
            offset: 0
        };

        this.delim = {
            char: ',',
            match: -1,
            prev: -1,
            next: -1
        };

        this.quote = {
            char: '"',
            match: -1,
            prev: -1,
            next: -1
        };

        this.newline = {
            char: opts.newline,
            match: -1,
            prev: -1,
            next: -1
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

        // console.log('COL', this.slice, this.rows, this.pos)

        this.pos++;
        this.slice = '';

        return undefined;

    }

    _flushRow (index) {

        // we skip the first row for adding headers
        // except when headers are disabled
        if (this.rows) {
            this.opts.cb(this.row);
        } else if (!this.opts.headers) {
            this.opts.cb(this.row);
        }

        // console.log('ROW', this.row, this.pos);

        this.rows++;
        this.row = {};
        // this.row = Object.create(this.obj);
        // this.row = new Row(this.headers);
        this.pos = 0;

        return undefined;

    }

    // append quote to string if needed
    // because we always advance offset, might miss on next match
    _handleQuote (index) {

        // console.log('HANDLE QUOTE', index)
        this.quote.next = this.line.str.indexOf(this.quote.char, index + 1);

        this.quoted = !this.quoted;

        if (!this.quoted) {
            this.slice += this.line.str.slice(this.line.offset, index);
            this.line.offset = index;
        } else {
            if (this.line.str[index-1] === '"') {
                this.slice += '"';
            }
        }

        this.line.offset += 1;
        // this.quote.match = this.line.str.indexOf(this.quote.char, ++index);

        this.quote.match = this.quote.next;

        // if (this.quote.next === index + 1) {
        //     this._handleQuote(this.quote.next);
        // } else if (this.delim.match > -1 && (this.delim.match < this.quote.match || (this.quote.match === -1))) {
        //     this._handleDelimeter(this.delim.match)
        // }

        if (this.delim.match === -1 && this.quote.match > -1) {
            // console.log('SHORTCUT')
            this._handleQuote(this.quote.match);
        // } else if (this.delim.match > -1 && (this.quote.match > -1) && (this.quote.match < this.delim.match)) {
        }
        else if (this.delim.match > -1) {
            if (this.quote.match > -1 && (this.quote.match < this.delim.match)) {
                this._handleQuote(this.quote.match);
            } else {
                this._handleDelimeter(this.delim.match);
            }
        }

        return;

    }

    // don't append delim if quoted, just skip
    // delims are included in string slices, so it gets picked up on next match
    _handleDelimeter (index) {

        // console.log('HANDLE DELIM', index, this.line.str.indexOf(this.delim.char, ++index))
        // console.log('HANDLE DELIM', this.quote.match)

        this.delim.next = this.line.str.indexOf(this.delim.char, index + 1);

        if (this.quoted) {
            // return;
        } else {
            this.slice += this.line.str.slice(this.line.offset, index);
            this.line.offset = index + 1;
            this._flushCol(index);
        }

        // this.delim.match = this.line.str.indexOf(this.delim.char, ++index);
        this.delim.match = this.delim.next;

        if (this.quote.match === -1 && this.delim.match > -1) {
            // console.log('SHORTCUT')
            this._handleDelimeter(this.delim.match);
        }
        else if (this.quote.match > -1) {
            if (this.delim.match > -1 && (this.delim.match < this.quote.match)) {
                this._handleDelimeter(this.delim.match);
            } else {
                this._handleQuote(this.quote.match);
            }
        }

        // if (this.delim.next === index + 1) {
        //     this._handleDelimeter(this.delim.next);
        // } else if (this.quote.match > -1 && (this.quote.match < this.delim.match || (this.delim.match === -1))) {
        //     this._handleQuote(this.quote.match);
        // }

        return;

    }

    // append newline to string if quoted
    // because newlines are not included in initial slices
    _handleNewline (index) {

        if (this.quoted) {
            this.line.str += this.newline.char;
        } else {
            this.slice += this.line.str.slice(this.line.offset, index);
            this.line.offset = index + this.newline.char.length;
            this._flushCol(index);
            // this._handleDelimeter(index);
            this._flushRow(index);
        }

        return;

    }

    _handleLine (str) {

        let line = this.line;

        line.delim = 0;
        line.quote = 0;
        line.match = 0;
        line.min = 0;
        line.max = 0;
        line.str += str;
        // line.offset = 0;

        this.delim.match = line.str.indexOf(this.delim.char, 0);
        this.quote.match = line.str.indexOf(this.quote.char, 0);

        // console.log('LINE!', this.delim, this.quote)

        // while (this.delim.match != -1 || this.quote.match != -1) {

            // console.log('HANDELINE WHILE')

            line.min = Math.min(this.delim.match, this.quote.match);
            line.max = Math.max(this.delim.match, this.quote.match);
            line.match = line.min > -1 ? line.min : line.max;

            // console.log('MATCH', line.match, this.delim.match, this.quote.match)

            switch (line.str[line.match]) {
                case ',':
                    this._handleDelimeter(line.match);
                    break;
                case '"':
                    this._handleQuote(line.match);
                    break;
            }

        // }

        // while (line.match != -1) {

        //     // don't search if we still have a valid
        //     // match from last call
        //     line.delim = line.delim >= line.match ? line.delim : line.str.indexOf(this.delimeter, line.match);
        //     line.quote = line.quote >= line.match ? line.quote : line.str.indexOf(this.quote, line.match);
        //     line.min = Math.min(line.delim, line.quote);
        //     line.max = Math.max(line.delim, line.quote);
        //     // line.mid = (line.delim + line.quote + line.newline) - min - max;
        //     // line.match = line.min > -1 ? line.min : line.mid > -1 ? line.mid : line.max;
        //     line.match = line.min > -1 ? line.min : line.max;

        //     if (line.match > -1) {

        //         switch (line.str[line.match]) {
        //             case ',':
        //                 this._handleDelimeter(line.delim);
        //                 break;
        //             case '"':
        //                 this._handleQuote(line.quote);
        //                 break;
        //         }

        //         line.match++;

        //     } else {
        //         this._handleNewline(line.str.length);
        //     }

        // }

        // if (line.offset < line.str.length) {
        //     line.str = line.str.slice(line.offset);
        // } else {
        //     line.str = '';
        // }

        // for (let i = 0; i < line.str.length; i++) {
        //     switch (line.str[i]) {
        //         case ',':
        //             this._handleDelimeter(i);
        //             break;
        //         case '"':
        //             this._handleQuote(i);
        //             break;
        //     }
        // }

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
