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

var getStub;
var reject = sinon.stub();
var resolve = sinon.stub();

describe('cacheWrapper', function() {

  afterEach(function() {
    sandbox.restore();
    resolve = sandbox.stub();
    reject = sandbox.stub();
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

    describe( 'when no policy is specified', function() {
      it('should reject the promise', function() {
        cache._retrieve( {
            reject: reject,
            resolve: resolve
          }, {
            segment: 'test',
            key: 'foo'
          });
        expect( reject ).to.be.calledWith( sinon.match.typeOf('error') );
      });
    });

    describe( 'when a policy is specified', function() {

      describe( 'and the cache get is successful', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields( null, 'RESULT' );
          cache.__set__( 'policies', {
            test: {
              get: getStub
            }
          });
          cache._retrieve( {
            reject: reject,
            resolve: resolve
          }, {
            segment: 'test',
            key: 'foo'
          });
        });

        it( 'should call the stub with the passed key argument', function() {
          expect( getStub ).to.be.calledWith( 'foo' );
        });
        it('should resolve the promise with the stubbed cache result', function() {
          expect( resolve ).to.be.called();
        });
      });

      describe( 'and the cache get fails', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields( 'ERROR' );
          cache.__set__( 'policies', {
            test: {
              get: getStub
            }
          });
          cache._retrieve( {
            reject: reject,
            resolve: resolve
          }, {
            segment: 'test',
            key: 'foo'
          });
        });
        it('should call the stub with the passed key argument', function() {
          expect( getStub ).to.be.calledWith( 'foo' );
        });
        it('should reject the promise with the stubbed cache result', function() {
          expect( reject ).to.be.calledWith( sinon.match.typeOf('error') );
        });
      });

    });

  });

  describe('_stash', function() {

    describe( 'when no policy is specified', function() {
      it('should reject the promise', function() {
        cache.__set__( 'policies', {} );
        cache._stash({
          reject: reject
        }, {} );
        expect( reject ).to.be.calledWith( sinon.match.typeOf('error') );
      });
    });

    describe( 'when a policy is specified', function() {

      describe( 'and the cache set is successful', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields( null, 'RESULT' );
          cache.__set__( 'policies', {
            test: {
              set: getStub
            }
          });
          cache._stash( {
            reject: reject,
            resolve: resolve
          }, {
            segment: 'test',
            key: 'foo',
            value: 'bar'
          });
        });

        it( 'should call the stub with the passed key and value arguments', function() {
          expect( getStub ).to.be.calledWith( 'foo', 'bar' );
        });
        it('should resolve the promise with the stubbed cache result', function() {
          expect( reject.callCount ).to.equal( 0 );
          expect( resolve ).to.be.called();
        });
      });

      describe( 'and the cache set fails', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields( 'ERROR' );
          cache.__set__( 'policies', {
            test: {
              set: getStub
            }
          });
          cache._stash( {
            reject: reject,
            resolve: resolve
          }, {
            segment: 'test',
            key: 'foo',
            value: 'bar'
          });
        });
        it('should call the stub with the passed key and value arguments', function() {
          expect( getStub ).to.be.calledWith( 'foo', 'bar' );
        });
        it('should reject the promise with an error', function() {
          expect( resolve.callCount ).to.equal( 0 );
          expect( reject ).to.be.calledWith( sinon.match.typeOf('error') );
        });
      });

    });

  });
});
