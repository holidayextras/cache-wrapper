'use strict';

var sinon = require('sinon');
var sandbox = sinon.sandbox.create();
var expect = require('chai')
  .use(require('dirty-chai'))
  .use(require('chai-as-promised'))
  .use(require('sinon-chai'))
  .expect;

var Q = require( 'q' );
var rewire = require( 'rewire' );
var cache = rewire( '../../lib/cacheWrapper' );

var Catbox = rewire( 'catbox' );

describe('cacheWrapper', function() {

  afterEach(function() {
    sandbox.restore();
  });

  describe('initialise', function() {
    
    var result;

    // beforeEach(function() {
    //   result = cache.initialise();
    // });

    // it('rejects the promise when no serverConfig is passed', function() {
    //   console.log( 'result', result );
    //   return expect(result).to.be.rejectedWith( 'no serverConfig passed' );
    // });

    // beforeEach( function() {

    //   Catbox.__set__( 'Client', function() {
    //     console.log('++');
    //     return {};
    //   } );

    //   // sandbox.stub(Catbox.Client, 'prototype.', function( ) {
    //   //   console.log('++');
    //   //   return {};
    //   // });
    //   result = cache.initialise({
    //     a: 'b'
    //   });
    // });

    // it('', function() {
    //   console.log( 'result', result );
    //   return expect(result).to.be.rejectedWith( 'no serverConfig passed' );
    // });

  });

  describe('_retrieve', function() {
    var result;
    var deferred;
    beforeEach(function() {
      // cache.__set__( 'policies', {
      //   kev: 'kev'
      // });
      deferred = Q.defer();
      cache._retrieve( deferred, {} );
    });

    it('kev', function() {
      console.log( 'deferred', deferred );
      return expect(deferred).to.eventually.equal( 'foo' );
    });

  });
});
