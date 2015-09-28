# cache-wrapper

[![Circle CI](https://circleci.com/gh/holidayextras/cache-wrapper/tree/master.svg?style=svg&circle-token=c8841a78d88271f74d5bda3a0c307056662d29ad)](https://circleci.com/gh/holidayextras/cache-wrapper/tree/master)

## About

A simple wrapper for catbox cache, that uses redis in production and memory when running in local development. This also offers queueing for requests if the connection to the cache server has dropped.

## Getting Started

You can start with cloning down the repo

```
$ git clone git@github.com:holidayextras/cache-wrapper
```

After you will need to install its dependencies

```
$ npm install
```

or to install this module to your project

```
npm install github.com/holidayextras/cache-wrapper --save
```

## Implementation

You must first initialise the cache and pass in the server configuration and your cache policies. You can then `get` and `set` your cache keys to your hearts content;

```
var cache = require( 'cache-wrapper' );

var serverConfig = {
	host: 'cache-production.t-bob.co.uk',
	port: 11211,
	partition: 'theWorks'
};

var cachePolicies = [
	{
		segment: 'myCacheSegment',
		expiresIn: 10000
	},
	{
		segment: 'myOtherCacheSegment',
		expiresIn: 300000
	}
];
cache.initialise( serverConfig, cachePolicies ).then( function() {
	cache.set( {
		segment: 'BobHoskinsFacts',
		key: 'Height',
		value: '5.5 feet'
	} ) .then( function() {
		cache.get( {
			segment: 'BobHoskinsFacts',
			key: 'Height'
		} ).then( console.log );	//OUTPUTS: "5.5 feet"
	} );
} );
```

## Contributing

Code is linted checked against the style guide with [make-up](https://github.com/holidayextras/make-up), running npm test will run all tests required.

## License
Copyright (c) 2015 Shortbreaks
Licensed under the MIT license.
