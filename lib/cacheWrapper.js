'use strict';

var cacheWrapper = module.exports = {};
var _ = require('lodash');
var Catbox = require('catbox');
var catboxRedis = require('catbox-redis');
var redisWrapper = require('./redisWrapper');
var Q = require('q');
var cacheClient;
var startingClient = false;
var queryQueue = [];
var policies = [];
var partition = '';

cacheWrapper.initialise = function(serverConfig, cachePolicies) {
  // no config, no cache...
  if (_.isEmpty(serverConfig) || _.isEmpty(serverConfig.partition)) {
    return Q.reject('Missing serverConfig/serverConfig.partition missing');
  }
  if (_.isEmpty(cachePolicies)) {
    return Q.reject('cachePolicies missing options(segment/expiresIn)');
  }
  partition = serverConfig.partition;

  var deferred = Q.defer();

  cacheClient = new Catbox.Client(catboxRedis, serverConfig);
  // Build all of the cache policies into the client
  _.each(cachePolicies, function(cachePolicy) {
    if (!_.isUndefined(cachePolicy.segment) && !_.isUndefined(cachePolicy.expiresIn)) {
      policies[cachePolicy.segment] = new Catbox.Policy(
        {
          expiresIn: cachePolicy.expiresIn
        },
        cacheClient, cachePolicy.segment
      );
    }
  });

  // fire up the client
  cacheClient.start(function() {
    redisWrapper.initialise(serverConfig)
    .then(function() {
      deferred.resolve();
    })
    .fail(function() {
      // Resolving here for now as some consumers don't handle rejection.
      // Will get it to reject in the next major release
      deferred.resolve('redis client was not initialised');
    });
  });
  return deferred.promise;
};

/**
* Finds a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment and key.
* @returns {null} Doesn't explicitly return, simply handles the promise passed in.
*/
cacheWrapper._retrieve = function(deferred, options) {
  if (policies[options.segment]) {
    policies[options.segment].get(options.key, function(error, cached) {
      if (error || !cached) {
        // catbox (Boom) errors are junk, we standardise by returning proper js errors
        deferred.reject(new Error('retrieve failed'));
      } else {
        deferred.resolve(cached);
      }
    });
  } else {
    deferred.reject(new Error('policy not found for segment'));
  }
};

/**
* Sets a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
* @returns {null} Doesn't explicitly return, simply handles the promise passed in.
*/
cacheWrapper._stash = function(deferred, options) {
  if (policies[options.segment]) {
    policies[options.segment].set(options.key, options.value, null, function(error) {
      if (error) {
        // catbox (Boom) errors are junk, we standardise by returning proper js errors
        deferred.reject(new Error('stash failed'));
      } else {
        deferred.resolve();
      }
    });
  } else {
    deferred.reject(new Error('policy not found for segment'));
  }
};

/**
* Drops a value for the given key in the given segment of the cache.
* @param {Object} options - Including segment and key.
* @returns {array} of promises.
*/
cacheWrapper._delete = function(options) {

  if (!policies[options.segment]) {
    return Q.reject(new Error('policy not found for segment'));
  }

  var dropPromises = options.keys.map(function(key) {
    var deferred = Q.defer();
    policies[options.segment].drop(key, function() {
      deferred.resolve();
    });
    return deferred.promise;
  }, []);
  return Q.allSettled(dropPromises);
};

/**
* Handles the request backlog and restarting the cache client if it's unavailable
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
* @returns {undefined} - nothing
*/
cacheWrapper._queueRequest = function(deferred, options) {
  // add the request to the queue
  queryQueue.push([ deferred, options ]);
  if (!startingClient) {
    startingClient = true;
    cacheClient.start(function(error) {
      _.forEach(queryQueue, function(queueItem) {
        // As you can see above, we push the deferred and the options into the array
        var queuePromise = queueItem[0];
        var queueOptions = queueItem[1];
        // error, cache restart failed...
        // else the cache has now connected
        if (error) {
          queuePromise.reject( new Error( options.method + ' failed' ) );
        } else if (options.method === 'stash') {
          cacheWrapper._stash(queuePromise, queueOptions);
        } else {
          cacheWrapper._retrieve(queuePromise, queueOptions);
        }
      });
      queryQueue = [];
      // we should now stop adding stuff to the queue
      startingClient = false;
    });
  }
};

/**
* Single interface to the cache plugin so we can manage the cacheClient effectively
* @param {Object} options - Including segment, key and value.
* @returns {Object} promise
*/
cacheWrapper._addCallToQueue = function(options) {
  if (!cacheClient) {
    return Q.reject(new Error('Cache not initialised'));
  }
  var deferred = Q.defer();
  if (!cacheClient.isReady()) {
    // cache isnt ready, queue it up
    cacheWrapper._queueRequest(deferred, options);
  } else {
    // execute the requested method straight away
    if (options.method === 'stash') {
      cacheWrapper._stash(deferred, options);
    } else {
      cacheWrapper._retrieve(deferred, options);
    }
  }
  return deferred.promise;
};

/**
* Allows you to add a `key/value` pair to the cache
* @param {Object} options - Including segment, key and value.
* @returns {Object} promise
*/
cacheWrapper.set = function(options) {
  options.method = 'stash';
  return cacheWrapper._addCallToQueue(options);
};

/**
* Allows you to retrieve a value from the cache for the passed `key`
* @param {Object} options - Including segment and key.
* @returns {Object} promise
*/
cacheWrapper.get = function(options) {
  options.method = 'retrieve';
  return cacheWrapper._addCallToQueue(options);
};

/**
* Drops records from the cache with the given prefix
* @param {Object} options - Including segment and prefix.
* @returns {Object} promise
*/
cacheWrapper.delete = function(options) {
  // we're going down to native redis and don't have the luxury of using Catbox to know the name of
  // the partition so we pull it off this instance
  options.partition = partition;
  // Catbox doesn't support the extremely useful `SCAN` function so use redis
  // to do that, then use Catbox to actually drop them
  return redisWrapper.scan(options)
  .then(cacheWrapper._delete)
  .fail( function() {
    return Q.resolve('Redis cache drop failed');
  });
};
