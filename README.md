# CSV
CSV Parser for Node Apps

Features:
* Easy to use
* Simple, Lightweight, Fast
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
`headers` | *`boolean\|object`* | If truthy, reads the first line as header fields. If false, disables header fields and replaces with integer values of 0-n. If object, the original header name field is replaced with it's value in the mapping. Default is `true`
`values` | *`boolean\|object`* | Same as the header field, but for values. If you want to replace values on the fly, provide an object: `{'null': null, 'True', true}`. Default is `null`
`newline` | *`string`* | Which character to use for newlines. Default is `\n`
`delimeter` | *`string`* | Which characer to use for delimeters. Default is `,`
`quote` | *`string`* | Which characer to use for quotes. Default is `"`
`cb` | *`function`* | Function to call when ready to flush a complete row. Used only for the `Parser` class. If you implement a custom parser you will need to include a cb function. Default is `_.noop`

### Methods
Name | Description
-----|------------
`Parser(opts)` | Low lever Parser class for generating a custom csv parser instance
`parse(str, opts)` | Syncronous parse function. Accepts a string and optional options object, returns an array of parsed rows
`stream(opts)` | Returns a transform stream used to parse csv data from strings or buffers
`promise(str, opts)` | Accepts a string to parse and optional options object. Returns a promise that resolves with an array of parsed rows

## Testing
Testing is currently run using mocha and chai. To execute tests just run `npm run test`. To generate unit test coverage reports just run `npm run coverage`

## Benchmarks
Benchmarks are currently built using gulp. Just run `gulp bench` to test timings and bytes per second

## Contact
If you have any questions feel free to get in touch
