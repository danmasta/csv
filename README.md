# CSV
CSV Parser for Node Apps

Features:
* Easy to use
* Simple, Lightweight, [Fast](#benchmarks)
* Parse csv data to js objects
* Header field mapping
* Value field mapping
* Supports [csv rfc spec 4180](https://tools.ietf.org/html/rfc4180)
* Memory safe, only keeps maximum of 1 row in memory during streaming
* Supports streaming, whole string parsing, and promises
* Supports multi-byte newlines `(\n, \r\n)`
* Custom delimiters, quotes, and newline support
* Works with buffers and strings
* Only 1 dependency: [lodash](https://github.com/lodash/lodash)

## About
After testing literally every CSV library on npm ([csv](https://www.npmjs.com/package/csv), [csv-parse](https://www.npmjs.com/package/csv-parse), [fast-csv](https://www.npmjs.com/package/fast-csv), [papaparse](https://www.npmjs.com/package/papaparse), [csvdata](https://www.npmjs.com/package/csvdata), [csv-parser](https://github.com/mafintosh/csv-parser), and more) in our BI system at work, we could only max out at about ~1k rows/ 1mb per second, and often far less depending on the library. We built a parser internally that helped us get a 12x boost to 12mb a second, combined with some other tricks we were able to bring our job processing down from several hours to ~10 minutes. This library is a result of those learnings, as well as testing as many different algorithms as I could find and/ or think of. After many many tests, this implementation was the fastest native javascript version I could find.

According to the self proclaimed fastest [csv-parser](https://github.com/mafintosh/csv-parser), this library is currently faster by a factor of 2.5x (on my i7 3770k from 2012), using the same [test data](https://github.com/mafintosh/csv-parser/blob/master/test/data/process_all_rows.csv), achieving around 35-40Mb per second processing, depending on data and cpu.

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
Filename                                Rows   Bytes       Time      Rows/Sec    Bytes/Sec
--------------------------------------  -----  ----------  --------  ----------  -------------
2010_Census_Populations_by_Zip_Code_LA  3199   120,912     12.8649   248,661.09  9,398,596.18
Demographic_Statistics_By_Zip_Code_NY   2369   263,168     40.7728   58,102.46   6,454,499.08
Earthquakes                             72689  11,392,064  268.2191  271,006.05  42,472,978.25
```

## Contact
If you have any questions feel free to get in touch
