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
    
    describe( 'when no policy is specified', function() {
      beforeEach(function() {
        deferred = Q.defer();
      });
      it('should reject the promise', function() {
        return expect( cache._retrieve( deferred, {} ) ).to.be.rejectedWith( Error, 'policy not found for segment' );
      });
    });

    describe( 'when a policy is specified', function() {
      
      describe( 'when the get() is successful', function() {
        var getStub;
        beforeEach(function() {
          getStub = sandbox.stub().yields( null, 'RESULT' );
          cache.__set__( 'policies', {
            test: {
              get: getStub
            }
          });
          deferred = Q.defer();
        });

        it( 'should call the stub with the passed key argument', function() {
          cache._retrieve( deferred, { segment: 'test', key: 'foo' } )
          return expect( getStub ).to.have.been.calledWith( 'foo' );
        });
        it('should resolve the promise with the stubbed cache result', function() {
          return expect( cache._retrieve( deferred, { segment: 'test' } ) ).to.eventually.deep.equal( 'RESULT' );
        });
      });

      describe( 'when the get() fails', function() {
        var getStub;
        beforeEach(function() {
          getStub = sandbox.stub().yields( 'ERROR' );
          cache.__set__( 'policies', {
            test: {
              get: getStub
            }
          });
          deferred = Q.defer();
        });
        it('should reject the promise with the stubbed cache result', function() {
          return expect( cache._retrieve( deferred, { segment: 'test' } ) ).to.be.rejectedWith( Error, 'retrieve failed' );
        });
      });

    });

  });
});
