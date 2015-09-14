# cache-wrapper

[![Build Status](https://api.shippable.com/projects/54ff09505ab6cc135296f99e/badge?branchName=master)](https://app.shippable.com/projects/54ff09505ab6cc135296f99e/builds/latest)

## About

A simple wrapper for catbox cache, that uses redis in production and memory when running in local development. This also offers queueing for requests in the connection to the cache server has dropped.

## Getting Started

You can start with cloneing down the repo

```
$ git clone git@github.com:holidayextras/cache-wrapper
```

or to install this module to your project you will need to add this line to your dependencies in your package.json

```
cache-wrapper: 'git+ssh://git@github.com/holidayextras/cache-wrapper'
```

After you will need to install this dependency and its dependencies

```
$ npm install
```

## Implementation

You must first initialise the cache and pass in the server configuration and your cache policies. You can then `get` and `set` your cache keys to your hearts content;

```
var cache = require( 'cache-wrapper' );

var serverConfig = {
	host: 'cache-production.t-bob.co.uk',
	port: '11211',
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
