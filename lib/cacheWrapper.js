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

  // Build all of the cache policies into the client
  _.each( cachePolicies, function( cachePolicy ) {
    policies[cachePolicy.segment] = new Catbox.Policy( { expiresIn: cachePolicy.expiresIn }, cacheClient, cachePolicy.segment );
  } );

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
      // was the restart successful
      if ( error ) {
        // cache failed, reject all the deferreds immediately
        _.forEach( queryQueue, function( queueItem ) {
          // As you can see above, we push the deferred and the options into the array
          var queuedPromise = queueItem[0];
          var queuedOptions = queueItem[1];
          queuedPromise.reject( new Error( queuedOptions.method + ' failed' ) );
        } );
        queryQueue = [];

      } else {
        // cache has now connected, fire off all
        // those queries that were backing up
        _.forEach( queryQueue, function( queueItem ) {
          // When we pump things into the queue array we put the promise in position 1 and the options object in position 2.
          var promiseToQueue = queueItem[0];
          var optionsToQueue = queueItem[1];
          if ( options.method === 'stash' ) {
            cacheWrapper._stash( promiseToQueue, optionsToQueue );
          } else {
            cacheWrapper._retrieve( promiseToQueue, optionsToQueue );
          }
        } );
        queryQueue = [];
      }

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
