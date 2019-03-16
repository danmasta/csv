# CSV
CSV Parser for Node Apps

Features:
* Easy to use
* Simple, lightweight, and [fast](#benchmarks)
* Parse csv data to js objects
* Header field mapping
* Value field mapping
* Supports csv spec [rfc 4180](https://tools.ietf.org/html/rfc4180)
* Memory safe, only keeps maximum of 1 row in memory during streaming
* Supports streaming, whole string parsing, and promises
* Supports multi-byte newlines `(\n, \r\n)`
* Custom delimiters, quotes, and newline support
* Works with buffers and strings
* Only 1 dependency: [lodash](https://github.com/lodash/lodash)

## About
I was working on a BI system at work, and as our user base kept growing, our jobs got slower and slower. A huge bottleneck for us was csv parsing. We tried many of the popular csv libraries on [npm](https://www.npmjs.com/search?q=csv), but were unable to get a decent level of performance consistently from our many jobs. We are parsing tens of millions of rows per day, with the average row being around 1.5kb, with 80+ columns (it's not uncommon for one job to parse up to 10gb of data). Some columns have complex json strings, some are empty, some are in languages like Chinese, and some use `\r\n` for new lines. We needed something fast, chunk boundary safe, and character encoding safe. Something that worked well on all of our various csv formats. Some of the other parsers failed to accurately parse `\r\n` newlines across chunk boundaries, some failed altogether, some caused out of memory errors, some were just crazy slow, and some had encoding errors with multi-byte characters.

We ended up creating a parser internally that helped us achieve better performance and stability for our jobs, drastically cutting down our job processing time. This library is a result of those learnings. It's fast, stable, works on any data, and is highly configurable. Based on the benchmarks from [csv-parser](https://github.com/mafintosh/csv-parser), this library currently provides increased throughput by a factor of ~3x (on my i7 3770k from 2012), using the same [test data](https://github.com/mafintosh/csv-parser/blob/master/test/data/process_all_rows.csv), achieving around 40-45Mb per second processing, depending on data and cpu.

## Usage
Add csv as a dependency for your app and install via npm
```
npm install @danmasta/csv --save
```
Require the package in your app
```javascript
const csv = require('@danmasta/csv');
```

### Options
name | type | description
-----|----- | -----------
`headers` | *`boolean\|object\|array\|function`* | If truthy, reads the first line as header fields. If false, disables header fields and replaces with integer values of 0-n. If object, the original header name field is replaced with it's value in the mapping. If function, the header field is set to the functions return value. Default is `true`
`values` | *`boolean\|object\|function`* | Same as the header field, but for values. If you want to replace values on the fly, provide an object: `{'null': null, 'True', true}`. If function, the value is replaced with the functions return value. Default is `null`
`newline` | *`string`* | Which character to use for newlines. Default is `\n`
`delimeter` | *`string`* | Which characer to use for delimeters. Default is `,`
`quote` | *`string`* | Which characer to use for quotes. Default is `"`
`cb` | *`function`* | Function to call when ready to flush a complete row. Used only for the `Parser` class. If you implement a custom parser you will need to include a cb function. Default is `_.noop`

### Methods
Name | Description
-----|------------
`Parser(opts)` | Low level Parser class for generating a custom csv parser instance
`parse(str, opts)` | Synchronous parse function. Accepts a string and optional options object, returns an array of parsed rows
`stream(opts)` | Returns a transform stream used to parse csv data from strings or buffers
`promise(str, opts)` | Accepts a string to parse and optional options object. Returns a promise that resolves with an array of parsed rows

## Examples
Use CRLF line endings
```javascript
csv.parse(str, { newline: '\r\n' });
```
Update header values
```javascript
let headers = {
    time: 'timestamp',
    latitude: 'lat',
    longitude: 'lng'
};

csv.parse(str, { headers });
```
Update headers and values with functions
```javascript
function headers (str) {
    return str.toLowerCase();
}

function values (val) {
    if (val === 'false') return false;
    if (val === 'true') return true;
    if (val === 'null' || val === 'undefined') return null;
    return val.toLowerCase();
}

csv.parse(str, { headers, values });
```
Create a custom parser that pushes to a queue
```javascript
const Queue = require('queue');
const q = new Queue();

const parser = new csv.Parser({ cb: q.push.bind(q) });

parser.parse(str);
parser.flush();
```

## Testing
Testing is currently run using mocha and chai. To execute tests just run `npm run test`. To generate unit test coverage reports just run `npm run coverage`

## Benchmarks
Benchmarks are currently built using gulp. Just run `gulp bench` to test timings and bytes per second
```
Filename     Rows    Bytes       Time (ms)  Rows/Sec    Bytes/Sec
-----------  ------  ----------  ---------  ----------  -------------
Earthquakes  72,689  11,392,064  251.01     289,582.99  45,384,418.26
```

## Contact
If you have any questions feel free to get in touch
