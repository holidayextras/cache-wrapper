/* jslint node: true */
'use strict';

var _ = require( 'lodash' );
var Catbox = require( 'catbox' );
var Memory = require( 'catbox-memory' );
var Redis = require( 'catbox-redis' );
var Q = require( 'q' );

var cacheClient;
var startingClient = false;
var queryQueue = [];
var policies = [];

function set( options ) {
	options.method = 'stash';
	return addCallToQueue( options );
}

function get( options ) {
	options.method = 'retrieve';
	return addCallToQueue( options );
}

/**
* Single interface to the cache plugin so we can manage the cacheClient effectively
* @param {Object} options - Including segment, key and value.
*/
function addCallToQueue( options ) {
	var deferred = Q.defer();
	if( !cacheClient ) {
		deferred.reject( new Error( 'Cache not intialised' ) );
	} else {
		if( !cacheClient.isReady() ) {
			// cache isnt ready, queue it up
			queueRequest( deferred, options );
		} else {
			// execute the requested method straight away
			if( options.method === 'stash' ) {
				stash( deferred, options );
			} else {
				retrieve( deferred, options );
			}
		}
	}
	return deferred.promise;
}

function initialise( serverConfig, cachePolicies ) {
	var deferred = Q.defer();
	// if we're in development mode we use an in-memory version of the
	// cache, saves people having to run a local Redis
	var catboxType = ( process.env.NODE_ENV === 'development' ) ? Memory : Redis;
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
}

/**
* Handles the request backlog and restarting the cache client if it's unavailable
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
*/
function queueRequest( deferred, options ) {
	// add the request to the queue
	queryQueue.push( [ deferred, options ] );

	if( !startingClient ) {
		startingClient = true;
		cacheClient.start( function( error ) {
			// was the restart successful
			if( error ) {
				// cache failed, reject all the deferreds immediately
				_.forEach( queryQueue, function( queueItem ) {
					var queuedPromise = queueItem[0];
					var options = queueItem[1];
					queuedPromise.reject( new Error( options.method + ' failed' ) );
				} );
				queryQueue=[];

			} else {
				// cache has now connected, fire off all
				// those queries that were backing up
				_.forEach( queryQueue, function( queueItem ) {
					var deferred = queueItem[0];
					var options = queueItem[1];
					if( options.method === 'stash' ) {
						stash( deferred, options );
					} else {
						retrieve( deferred, options );
					}
				} );
				queryQueue=[];
			}

			// we should now stop adding stuff to the queue
			startingClient = false;
		} );
	}
}

/**
* Finds a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment and key.
*/
function retrieve( deferred, options ) {
	if( policies[options.segment] ) {
		policies[options.segment]['get']( options.key, function( error, cached ) {
			if( error || !cached ) {
				// catbox (Boom) errors are junk, we standardise by returning proper js errors
				deferred.reject( new Error( 'retrieve failed' ) );
			} else {
				deferred.resolve( cached );
			}
		} );
	} else {
		deferred.reject( new Error( 'policy not found for segment' ) );
	}
}

/**
* Sets a value for the given key in the given segment of the memory store.
* @param {Object} deferred - A promise to manage flow.
* @param {Object} options - Including segment, key and value.
*/
function stash( deferred, options ) {
	if( policies[options.segment] ) {
		policies[options.segment]['set']( options.key, options.value, null, function( error ) {
			if( error ) {
				// catbox (Boom) errors are junk, we standardise by returning proper js errors
				deferred.reject( new Error( 'stash failed' ) );
			} else {
				deferred.resolve();
			}
		} );
	} else {
		deferred.reject( new Error( 'policy not found for segment' ) );
	}
}

exports = module.exports = {
	initialise: initialise,
	set: set,
	get: get
};