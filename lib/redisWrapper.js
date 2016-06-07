'use strict';

var redisWrapper = module.exports = {};

var Q = require( 'q' );
var redis = require( 'redis' );
var _ = require( 'lodash' );

var redisClient;
var separator = ':';
var wildcard = '*';

redisWrapper.initialise = function(serverConfig) {
  var deferred = Q.defer();
  redisClient = redis.createClient(serverConfig);
  redisClient.on( 'ready', function () {
    deferred.resolve();
  } );
  return deferred.promise;
};

redisWrapper.keys = function( options ) {
  var deferred = Q.defer();
  // do stuff that Catbox used to do for us
  var cacheNamespace = options.partition + separator + options.segment + separator;
  var prefix = cacheNamespace + encodeURIComponent( options.prefix ) + wildcard;
  redisClient.keys(prefix, function (err, results) {
    if (err) {
      deferred.reject();
    } else {
      options.keys = _.map(results, function(key) {
        // strip off the cache namespace
        return decodeURIComponent( key.replace(cacheNamespace, '') );
      } );
      deferred.resolve(options);
    }
  } );
  return deferred.promise;
};
