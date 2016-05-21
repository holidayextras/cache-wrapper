'use strict';

var redisWrapper = module.exports = {};

var Q = require( 'q' );
var redis = require( 'redis' );
var _ = require( 'lodash' );

var redisClient;
var separator = ':';
var wildcard = '*';

redisWrapper.initialise = function( serverConfig ) {
	var deferred = Q.defer();
  redisClient = redis.createClient( serverConfig );
  redisClient.on( 'ready', function (err) {
    deferred.resolve();
  } );
  return deferred.promise;
};

redisWrapper.keys = function( options ) {
	var deferred = Q.defer();
	console.log( 'options', options );
	// do stuff that Catbox used to do for us
	// need to get the `partition` from somewhere
	var cacheNamespace = 'cacheWrapper' + separator + options.segment + separator
	var prefix = cacheNamespace + encodeURIComponent( options.prefix ) + wildcard;

	redisClient.keys(prefix, function (err, results) {
		console.log( 'results', results );
		options.keys = _.map( results, function( key ) {
			// strip off the cache namespace
			return decodeURIComponent( key.replace( cacheNamespace, '') );
		} );
		deferred.resolve( options );
	} );
	return deferred.promise;
};