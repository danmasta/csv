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
* Supports streaming, string parsing, and promises
* Supports multi-byte newlines `(\n, \r\n)`
* Custom newline support
* Works with buffers and strings
* Only 1 dependency: [lodash](https://github.com/lodash/lodash)

## About
I was working on a BI system at work and as our user base kept growing, our jobs got slower and slower. A huge bottleneck for us was csv parsing. We tried many of the popular csv libraries on [npm](https://www.npmjs.com/search?q=csv), but were unable to get a decent level of performance consistently from our many jobs. We are parsing around a billion rows per day, with the average row being around 1.5kb and 80+ columns (it's not uncommon for a single job to parse over 10gb of data). Some columns have complex json strings, some are empty, some are in languages like Chinese, and some use `\r\n` for new lines. We needed something fast, chunk boundary safe, and character encoding safe. Something that worked well on all of our various csv formats. Some of the other parsers failed to accurately parse `\r\n` newlines across chunk boundaries, some failed altogether, some caused out of memory errors, some were just crazy slow, and some had encoding errors with multi-byte characters.

This library is a result of those learnings. It's fast, stable, works on any data, and is highly configurable. Feel free to check out and run the [benchmarks](#benchmarks). I'm currently able to achieve around 100mb per second parsing (on a i7 9700k), depending on data and cpu.

## Usage
Add csv as a dependency for your app and install via npm
```
npm install @danmasta/csv --save
```
Require the package in your app
```javascript
const csv = require('@danmasta/csv');
```
By default csv returns a [transform stream](https://nodejs.org/api/stream.html#stream_implementing_a_transform_stream) interface. You can use the methods: `promise()`, `map()`, `each()`, and `parse()` to consume row objects via promises or as a synchronous array.

### Options
name | type | description
-----|----- | -----------
`headers` | *`boolean\|object\|array\|function`* | If truthy, reads the first line as header fields. If false, disables header fields and replaces with integer values of 0-n. If object, the original header name field is replaced with it's value in the mapping. If function, the header field is set to the functions return value. Default is `true`
`values` | *`boolean\|object\|function`* | Same as the header field, but for values. If you want to replace values on the fly, provide an object: `{'null': null, 'True', true}`. If function, the value is replaced with the functions return value. Default is `null`
`newline` | *`string`* | Which character to use for newlines. Default is `\n`
`cb` | *`function`* | Function to call when ready to flush a complete row. Used only for the `Parser` class. If you implement a custom parser you will need to include a cb function. Default is `this.push`
`buffer` | *`boolean`* | If `true`, uses a string decoder to parse buffers. This is set automatically with convenience methods, but will need to be set on custom parser instances. Default is `false`
`encoding` | *`string`* | Which encoding to use when parsing rows in buffer mode. This doesn't matter if using strings or streams not in buffer mode. Default is `utf8`
`stream` | *`object`* | Options to be passed to transform stream constructor. Default is `{ objectMode: true, encoding: null }`

### Methods
Name | Description
-----|------------
`Parser(opts, str)` | Parser class for generating custom csv parser instances. Accepts an options object and optional string or buffer to parse
`Parser.parse(str, opts)` | Synchronous parse function. Accepts a string or buffer and optional options object. Returns an array of parsed rows
`promise()` | Returns a promise that resolves with an array of parsed rows
`map(fn)` | Runs an iterator function over each row. Returns a promise that resolves with the new `array`
`each(fn)` | Runs an iterator function over each row. Returns a promise that resolves with `undefined`
`parse(str)` | Parses a string or buffer and pushes rows to stream. Need to call `flush()` when finished. Returns the csv parser instance
`flush()` | Flushes remaining data and pushes final rows to stream. Returns the csv parser instance

## Examples
Use CRLF line endings
```javascript
csv.parse(str, { newline: '\r\n' });
```

Parse input from a stream and write rows to a destination stream
```js
let read = fs.createReadStream('./data.csv');

read.pipe(csv()).pipe(myDestinationStream());
```

Parse a string and get results in a promise
```js
csv().parse(str).promise().then(res => {
    console.log('Rows:', res);
});
```

Run an iteration function over each row using `each()`
```js
csv().parse(str).each(row => {
    console.log('Row:', row);
}).then(() => {
    console.log('Parse complete!');
});
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


Update headers and/or values with functions
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

const parser = csv({ cb: q.push.bind(q) });

parser.parse(str);
parser.flush();
```

## Testing
Testing is currently run using mocha and chai. To execute tests just run `npm run test`. To generate unit test coverage reports just run `npm run coverage`

## Benchmarks
Benchmarks are currently built using gulp. Just run `gulp bench` to test timings and bytes per second
```
Filename         Mode    Density  Rows    Bytes       Time (ms)  Rows/Sec      Bytes/Sec
---------------  ------  -------  ------  ----------  ---------  ------------  --------------
Earthquakes      String  0.11     72,689  11,392,064  121.66     597,492.68    93,641,058.06
Earthquakes      Buffer  0.11     72,689  11,392,064  104.8      693,582.44    108,700,567.12
Pop-By-Zip-LA    String  0.18     3,199   120,912     1.88       1,702,582.7   64,352,197.35
Pop-By-Zip-LA    Buffer  0.18     3,199   120,912     1.28       2,490,424.44  94,130,103.07
Stats-By-Zip-NY  String  0.41     2,369   263,168     15.68      151,058.46    16,780,816.02
Stats-By-Zip-NY  Buffer  0.41     2,369   263,168     14.52      163,183.15    18,127,726.59
```
*Speed and throughput are highly dependent on the density (token matches/byte length) of data as well as the size of the objects created. The [earthquakes](https://github.com/danmasta/csv/blob/master/tests/data/Earthquakes.csv) file test data represents a roughly average level of density for common csv datas. The [stats by zip code](https://github.com/danmasta/csv/blob/master/tests/data/Stats-By-Zip-NY.csv) file represents an example of very dense csv data*

## Contact
If you have any questions feel free to get in touch
