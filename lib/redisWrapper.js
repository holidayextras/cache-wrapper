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
  if(_.isEmpty(serverConfig)) {
    deferred.reject('no serverConfig passed');
  } else {
    redisClient = redis.createClient(serverConfig);
    redisClient.on('ready', function () {
      deferred.resolve();
    });
    // if there was error connecting to redis server
    redisClient.on('error', function () {
      deferred.reject();
    });

  }
  return deferred.promise;
};
// using SCAN here and not KEYS to avoid blocking the server for a long time when called against big collections of keys or elements.
redisWrapper.scan = function(options) {
  var deferred = Q.defer();
  if(_.isEmpty(options)
    || _.isUndefined(options.partition)
    || _.isUndefined(options.segment)
    || _.isUndefined(options.prefix)) {
    return Q.reject('Required options not passed in');
  }
  // do stuff that Catbox used to do for us
  var cacheNamespace = options.partition + separator + encodeURIComponent(options.segment) + separator;
  var prefix =  cacheNamespace + encodeURIComponent(options.prefix) + wildcard;

  redisClient.scan(0, 'MATCH', prefix, function (err, results) {
    if (err) {
      deferred.reject();
    } else {
      options.keys = _.map(results[1], function(key) {
        // strip off the cache namespace
        return decodeURIComponent(key.replace(cacheNamespace, ''));
      });

      deferred.resolve(options);
    }
  });
  return deferred.promise;
};
