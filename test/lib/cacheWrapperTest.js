'use strict';

process.env.NODE_ENV = 'development';

var cache = require( '../../lib/cacheWrapper' );
var chai = require( 'chai' );
chai.use( require( 'chai-as-promised' ) );
var expect = chai.expect;

var Catbox = require( 'catbox' );

var sinon = require( 'sinon' );

var policies = [ {
  segment: 'foo',
  expiresIn: 10000
} ];

var serverConfig = {};

var cacheItem = {
  segment: 'foo',
  key: 'bar',
  value: 'baz'
};

var nonExistantCacheItem = {
  segment: 'foo',
  key: 'noExist'
};

var nonExistantCachePolicy = {
  segment: 'noExist',
  key: 'noExist'
};

var brokenCacheItem = {
  segment: 'foo',
  key: true,
  value: 'baz'
};

var isReadyStub;
var startStub;

describe( 'Cache', function() {

  it( 'should fail to set an item in the cache before it has initialised', function() {
    return expect( cache.set( cacheItem ) ).to.be.rejected;
  } );

  it( 'should initialise the cache', function() {
    return expect( cache.initialise( serverConfig, policies ) ).to.be.fulfilled;
  } );

  it( 'should set an item in the cache', function() {
    return expect( cache.set( cacheItem ) ).to.be.fulfilled;
  } );

  it( 'should get the item from the cache', function() {
    return expect( cache.get( cacheItem ) ).to.be.fulfilled.and.to.eventually.equal( cacheItem.value );
  } );

  it( 'should fail to get a non-existant item from the cache', function() {
    return expect( cache.get( nonExistantCacheItem ) ).to.be.rejected;
  } );

  it( 'should fail to get a non-existant policy item from the cache', function() {
    return expect( cache.get( nonExistantCachePolicy ) ).to.be.rejected;
  } );

  it( 'should fail to set an item in a non-existant policy', function() {
    return expect( cache.set( nonExistantCachePolicy ) ).to.be.rejected;
  } );

  it( 'should fail to set an item that is broken', function() {
    return expect( cache.set( brokenCacheItem ) ).to.be.rejected;
  } );

  context( 'Cache not ready, queue it', function() {

    before( function() {
      isReadyStub = sinon.stub( Catbox.Client.prototype, 'isReady', function() {
        return false;
      } );
    } );

    after( function() {
      isReadyStub.restore();
    } );

    it( 'should queue and then set an item in the cache', function() {
      return expect( cache.set( cacheItem ) ).to.be.fulfilled;
    } );

    it( 'should queue and then get an item from the cache', function() {
      return expect( cache.get( cacheItem ) ).to.be.fulfilled.and.to.eventually.equal( cacheItem.value );
    } );

  } );

  context( 'Cache start error', function() {

    before( function() {
      isReadyStub = sinon.stub( Catbox.Client.prototype, 'isReady', function() {
        return false;
      } );
      startStub = sinon.stub( Catbox.Client.prototype, 'start', function( callback ) {
        return callback( 'error' );
      } );
    } );

    after( function() {
      startStub.restore();
      isReadyStub.restore();
    } );

    it( 'should fail to queue and then set an item in the cache', function() {
      return expect( cache.set( cacheItem ) ).to.be.rejected;
    } );

    it( 'should fail to queue and then get an item from the cache', function() {
      return expect( cache.get( cacheItem ) ).to.be.rejected;
    } );

  } );

} );
