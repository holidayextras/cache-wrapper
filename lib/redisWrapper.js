'use strict';

var redisWrapper = module.exports = {};
var Q = require('q');
var redis = require('redis');
var _ = require('lodash');
var redisClient;
var separator = ':';
var wildcard = '*';

redisWrapper.initialise = function(serverConfig) {
  var deferred = Q.defer();
  if (_.isEmpty(serverConfig)) {
    deferred.reject('no serverConfig passed');
  } else {
    redisClient = redis.createClient(serverConfig);
    redisClient.on('ready', function () {
      deferred.resolve();
    });
    // if there was error connecting to redis server
    redisClient.on('error', function () {
      deferred.reject( 'Error trying to connect to redis server');
    });

  }
  return deferred.promise;
};
/**
* Allows you to retrieve a keys which have a value matching the pattern passed in prefix.
* Using SCAN here and not KEYS to avoid blocking the server for a long time when called against big collections of keys or elements.
* @param {Object} options - Including partition,segment,prefix.
* @returns {Object} promise
*/
redisWrapper.scan = function(options) {
  var deferred = Q.defer();
  if (_.isEmpty(options)
    || _.isUndefined(options.partition)
    || _.isUndefined(options.segment)
    || _.isUndefined(options.prefix)) {
    return Q.reject('Required options not passed in');
  }
  // do stuff that Catbox used to do for us
  var cacheNamespace = options.partition + separator + encodeURIComponent(options.segment) + separator;
  var prefix = cacheNamespace + encodeURIComponent(options.prefix) + wildcard;
  // Scan iterates through the keys and returns the ones matching the given prefix
  redisClient.scan(0, 'MATCH', prefix, function (err, results) {
    if (err) {
      deferred.reject( 'Redis SCAN failed' );
    } else {
      // result is an array of 2 values the results[0] first value is the new cursor to use in the next call,
      // the second results[1] is the list of keys that match the pattern which we are interested in
      options.keys = _.map(results[1], function(key) {
        // strip off the cache namespace
        return decodeURIComponent(key.replace(cacheNamespace, ''));
      });

      deferred.resolve(options);
    }
  });
  return deferred.promise;
};
