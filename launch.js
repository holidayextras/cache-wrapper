/* jslint node: true */
'use strict';

// get Elephant and frickin use it!
var cacheWrapper = require( './index' );

cacheWrapper.initialise( '', [ {
	segment: 'foo',
	expiresIn: 10000
} ] ).then( function() {
	cacheWrapper.set( {
		segment: 'foo',
		key: 'bar',
		value: 'baz'
	} ).then( function() {
		cacheWrapper.get( {
			segment: 'foo',
			key: 'bar'
		} ).then( console.log );
		cacheWrapper.get( {
			segment: 'foo',
			key: 'bar'
		} ).then( console.log );
		cacheWrapper.get( {
			segment: 'foo',
			key: 'bar'
		} ).then( console.log );
	} ).fail( console.log );
} ).fail( console.log );