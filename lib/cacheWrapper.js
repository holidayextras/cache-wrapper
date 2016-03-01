/* jslint node: true */
'use strict';

var cacheWrapper = module.exports = {};

var _ = require( 'lodash' );
var Catbox = require( 'catbox' );
var catboxMemory = require( 'catbox-memory' );
var catboxRedis = require( 'catbox-redis' );
var Q = require( 'q' );

var cacheClient;
var startingClient = false;
var queryQueue = [];
var policies = [];

cacheWrapper.initialise = function( serverConfig, cachePolicies ) {
  var deferred = Q.defer();
  // if we're in development mode we use an in-memory version of the
  // cache, saves people having to run a local Redis
  var catboxType = ( process.env.NODE_ENV === 'development' ) ? catboxMemory : catboxRedis;
  cacheClient = new Catbox.Client( catboxType, serverConfig );
  // Build the cache policies into the client
  if ( !_.isEmpty( cachePolicies ) ) {
    cacheWrapper.addCachePolicies( cachePolicies );
  }

  // // Build all of the cache policies into the client
  // _.each( cachePolicies, function( cachePolicy ) {
  //   policies[cachePolicy.segment] = new Catbox.Policy( { expiresIn: cachePolicy.expiresIn }, cacheClient, cachePolicy.segment );
  // } );

  // fire up the client
  cacheClient.start( function() {
    deferred.resolve();
  } );
  return deferred.promise;
};


/**
* Finds a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment and key.
* @returns {null} Doesn't explicitly return, simply handles the promis passed in.
*/
cacheWrapper._retrieve = function( deferred, options ) {
  if ( policies[options.segment] ) {
    policies[options.segment].get( options.key, function( error, cached ) {
      if ( error || !cached ) {
        // catbox (Boom) errors are junk, we standardise by returning proper js errors
        deferred.reject( new Error( 'retrieve failed' ) );
      } else {
        deferred.resolve( cached );
      }
    } );
  } else {
    deferred.reject( new Error( 'policy not found for segment' ) );
  }
};

/**
* Sets a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
* @returns {null} Doesn't explicitly return, simply handles the promis passed in.
*/
cacheWrapper._stash = function( deferred, options ) {
  if ( policies[options.segment] ) {
    policies[options.segment].set( options.key, options.value, null, function( error ) {
      if ( error ) {
        // catbox (Boom) errors are junk, we standardise by returning proper js errors
        deferred.reject( new Error( 'stash failed' ) );
      } else {
        deferred.resolve();
      }
    } );
  } else {
    deferred.reject( new Error( 'policy not found for segment' ) );
  }
};

/**
* Handles the request backlog and restarting the cache client if it's unavailable
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
* @returns {undefined} - nothing
*/
cacheWrapper._queueRequest = function( deferred, options ) {
  // add the request to the queue
  queryQueue.push( [ deferred, options ] );

  if ( !startingClient ) {
    startingClient = true;
    cacheClient.start( function( error ) {
      _.forEach( queryQueue, function( queueItem ) {
        // As you can see above, we push the deferred and the options into the array
        var queuePromise = queueItem[0];
        var queueOptions = queueItem[1];
        // error, cache restart failed...
        // else the cache has now connected
        if ( error ) {
          queuePromise.reject( new Error( options.method + ' failed' ) );
        } else if ( options.method === 'stash' ) {
          cacheWrapper._stash( queuePromise, queueOptions );
        } else {
          cacheWrapper._retrieve( queuePromise, queueOptions );
        }
      } );
      queryQueue = [];
      // we should now stop adding stuff to the queue
      startingClient = false;
    } );
  }
};

/**
* Single interface to the cache plugin so we can manage the cacheClient effectively
* @param {Object} options - Including segment, key and value.
* @returns {Object} promise
*/
cacheWrapper._addCallToQueue = function( options ) {
  var deferred = Q.defer();
  if ( !cacheClient ) {
    deferred.reject( new Error( 'Cache not initialised' ) );
  } else {
    if ( !cacheClient.isReady() ) {
      // cache isnt ready, queue it up
      cacheWrapper._queueRequest( deferred, options );
    } else {
      // execute the requested method straight away
      if ( options.method === 'stash' ) {
        cacheWrapper._stash( deferred, options );
      } else {
        cacheWrapper._retrieve( deferred, options );
      }
    }
  }
  return deferred.promise;
};

cacheWrapper.set = function( options ) {
  options.method = 'stash';
  return cacheWrapper._addCallToQueue( options );
};

cacheWrapper.get = function( options ) {
  options.method = 'retrieve';
  return cacheWrapper._addCallToQueue( options );
};
cacheWrapper.getCachePolicy = function( cachePolicySegment ) {
  if ( _.isUndefined( policies[cachePolicySegment] ) ) {
    return Q.resolve( policies[cachePolicySegment] );
  }
  Q.reject( new Error( 'Policy not fount for segment' ) );
};
cacheWrapper.addCachePolicies = function( cachePolicies ) {
  _.each( cachePolicies, function( cachePolicy ) {
    if ( _.isUndefined( policies[cachePolicy.segment] ) ) {
      policies[cachePolicy.segment] = new Catbox.Policy( { expiresIn: cachePolicy.expiresIn }, cacheClient, cachePolicy.segment );
    }
  } );
  return Q.resolve();
};
