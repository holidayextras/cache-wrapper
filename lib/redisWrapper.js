var redisWrapper = module.exports = {}
var Q = require('q')
var redis = require('redis')
var _ = require('lodash')
var redisClient
var separator = ':'
var wildcard = '*'

redisWrapper.initialise = function (serverConfig) {
  var deferred = Q.defer()
  if (_.isEmpty(serverConfig)) {
    deferred.reject('no serverConfig passed')
  } else {
    redisClient = redis.createClient(serverConfig)
    redisClient.on('ready', function () {
      deferred.resolve()
    })
    // if there was error connecting to redis server
    redisClient.on('error', function () {
      deferred.reject('Error trying to connect to redis server')
    })
  }
  return deferred.promise
}
/**
* Allows you to retrieve a keys which have a value matching the pattern passed in prefix.
* @param {Object} options - Including partition,segment,prefix.
* @returns {Object} promise
*/
redisWrapper.scan = function (options) {
  var deferred = Q.defer()
  if (_.isEmpty(options) ||
    _.isUndefined(options.partition) ||
    _.isUndefined(options.segment) ||
    _.isUndefined(options.prefix)) {
    return Q.reject('Required options not passed in')
  }
  options.keys = []
  options.newCursor = 0
  // do stuff that Catbox used to do for us
  var cacheNamespace = options.partition + separator + encodeURIComponent(options.segment) + separator
  var prefix = cacheNamespace + encodeURIComponent(options.prefix) + wildcard
  return redisWrapper._recursiveScan(options, prefix, cacheNamespace, deferred)
}
/**
* Allows you to recursively retrieve all keys which have a value matching the pattern passed in prefix.
* Using SCAN here and not KEYS to avoid blocking the server for a long time when called against big collections of keys or elements.
* @param {Object} options - Including keys,newCursor.
* @param {Object} prefix - cache fields to match.
* @param {Object} cacheNamespace - cache namespace.
* @param {Object} deferred - A promise to manage flow.
* @returns {Object} promise - A promise.
*/
redisWrapper._recursiveScan = function (options, prefix, cacheNamespace, deferred) {
  // Scan iterates through the keys and returns the ones matching the given prefix
  // Scan has a default count of 10 meaning it will only scan 10 keys,
  // have set the count to 300 to reduce time it takes to scan the entire redis DB
  // Need to use caution if increasing the count, as it could cause the redis server to be blocked for a long time.
  redisClient.scan(options.newCursor, 'MATCH', prefix, 'COUNT', 300, function (err, results) {
    if (err) {
      deferred.reject('Redis SCAN failed')
    } else {
      // result is an array of 2 values the results[0] first value is the new cursor to use in the next call
      options.newCursor = results[0]
      // the second results[1] is the list of keys that match the pattern
      var keys = _.map(results[1], function (key) {
        // strip off the cache namespace
        return decodeURIComponent(key.replace(cacheNamespace, ''))
      })
      // push the found keys into the keys array to be returned after finidhing the scan.
      options.keys = options.keys.concat(keys)
      // if the scan has not finished searching all entries continue to scan again using the newCusor position to start
      if (options.newCursor > 0) {
        redisWrapper._recursiveScan(options, prefix, cacheNamespace, deferred)
      } else {
        deferred.resolve(options)
      }
    }
  })
  return deferred.promise
}
