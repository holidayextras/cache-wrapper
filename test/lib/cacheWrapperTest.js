'use strict';

var sinon = require('sinon');
var sandbox = sinon.sandbox.create();
var expect = require('chai')
  .use(require('dirty-chai'))
  .use(require('chai-as-promised'))
  .use(require('sinon-chai'))
  .expect;
var redisWrapper = require('../../lib/redisWrapper');

var Q = require('q');
var rewire = require('rewire');
var cache = rewire('../../lib/cacheWrapper');
var Catbox = rewire('catbox');
var getStub;
var redisWrapperStub;
var deferred = {};

describe('cacheWrapper', function() {

  afterEach(function() {
    sandbox.restore();
    deferred.resolve = sandbox.stub();
    deferred.reject = sandbox.stub();
    cache.__set__('policies', {});
  });

  describe('initialise', function() {
    var serverConfig = {
      partition: 'test'
    };
    var policies = [
      {
        expiresIn: 10000,
        segment: 'test'
      },
      {
        segment: 'testSegment'
      }
    ];
    describe('when server config is not passed ', function() {
      it('rejects the promise', function() {
        return expect(cache.initialise()).to.be.rejectedWith('Missing serverConfig/serverConfig.partition');
      });
    });
    describe('when cache policy is not passed ', function() {

      it('rejects the promise when cache policy options are not passed', function() {
        return expect(cache.initialise(serverConfig)).to.be.rejectedWith('cachePolicies missing options(segment/expiresIn)');
      });
    });

    describe('when serverconfig and cachePolicies are passed in ', function() {
      beforeEach(function() {
        Catbox.__set__({
          Policy: function() {}
        });
        Catbox.Policy = sandbox.spy();
      });

      describe(' and redis client is initialised', function() {

        it('should set policies', function() {
          return cache.initialise(serverConfig, policies)
          .then(function() {
            expect(Catbox.Policy).to.be.calledOnce();
          });
        });
      });

      describe('and redis client is not initialised', function() {
        beforeEach(function() {
          redisWrapperStub = sandbox.stub(redisWrapper, 'initialise', function() {
            return Q.reject('Failed');
          });
        });
        it('should be rejected', function() {
          return cache.initialise(serverConfig, policies)
            .fail(function(result) {
              expect(result).to.equal('redis client was not initialised');
              expect(redisWrapperStub).to.be.calledOnce();
            });
        });
      });
    });
  });

  describe('_retrieve', function() {
    var options = {
      segment: 'test',
      key: 'foo'
    };

    describe('when no policy is specified', function() {
      it('should reject the promise', function() {
        cache._retrieve(deferred, options);
        expect(deferred.reject).to.be.calledWith(sinon.match.typeOf('error'));
      });
    });

    describe('when a policy is specified', function() {

      describe('and the cache get is successful', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields(null, 'RESULT');
          cache.__set__('policies', {
            test: {
              get: getStub
            }
          });
          cache._retrieve(deferred, options);
        });

        it('should call the stub with the passed key argument', function() {
          expect(getStub).to.be.calledWith('foo');
        });
        it('should resolve the promise with the stubbed cache result', function() {
          expect(deferred.resolve).to.be.called();
        });
      });

      describe('and the cache get fails', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields('ERROR');
          cache.__set__('policies', {
            test: {
              get: getStub
            }
          });
          cache._retrieve(deferred, options);

        });
        it('should call the stub with the passed key argument', function() {
          expect(getStub).to.be.calledWith('foo');
        });
        it('should reject the promise with the stubbed cache result', function() {
          expect(deferred.reject).to.be.calledWith(sinon.match.typeOf('error'));
        });
      });

    });

  });

  describe('_stash', function() {

    describe('when no policy is specified', function() {
      it('should reject the promise', function() {
        cache._stash(deferred, {});
        expect(deferred.reject).to.be.calledWith(sinon.match.typeOf('error'));
      });
    });

    describe('when a policy is specified', function() {
      var stashOptions = {
        segment: 'test',
        key: 'foo',
        value: 'bar'
      };
      describe('and the cache set is successful', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields(null, 'RESULT');
          cache.__set__('policies', {
            test: {
              set: getStub
            }
          });
          cache._stash(deferred, stashOptions);
        });

        it('should call the stub with the passed key and value arguments', function() {
          expect(getStub).to.be.calledWith('foo', 'bar');
        });
        it('should resolve the promise with the stubbed cache result', function() {
          expect(deferred.reject).to.not.have.been.called();
          expect(deferred.resolve).to.be.called();
        });
      });

      describe('and the cache set fails', function() {
        beforeEach(function() {
          getStub = sandbox.stub().yields('ERROR');
          cache.__set__('policies', {
            test: {
              set: getStub
            }
          });
          cache._stash(deferred, stashOptions);

        });
        it('should call the stub with the passed key and value arguments', function() {
          expect(getStub).to.be.calledWith('foo', 'bar');
        });
        it('should reject the promise with an error', function() {

          expect(deferred.resolve.callCount).to.equal(0);
          expect(deferred.reject).to.be.calledWith(sinon.match.typeOf('error'));
        });
      });

    });

  });


  describe('_delete', function() {
    var deleteOptions = {
      segment: 'test',
      keys: ['foo', 'foo1']
    };
    describe('when no policy is specified', function() {
      it('should reject the promise', function() {
        expect(cache._delete({})).to.be.rejected();
      });
    });
    describe('when  policy is specified', function() {
      it('should resolve the promise', function() {
        cache.__set__('policies', {
          test: {
            drop: getStub
          }
        });

        return cache._delete(deleteOptions)
        .then(function(result){
          expect(result[0].state).to.deep.equal('fulfilled');
          expect(result[1].state).to.deep.equal('fulfilled');

        });
      });
    });

  });

  describe('_queueRequest', function() {
    var stashQueueOptions = {
      method: 'stash',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };
    var retrieveQueueOptions = {
      method: 'retrieve',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };
    describe('when startingClient is false', function() {
      beforeEach(function() {
        getStub = sandbox.stub().yields(null, 'RESULT');
        cache._retrieve = sandbox.stub();
        cache._stash = sandbox.stub();

        cache.__set__({
          cacheClient: {
            start: getStub
          },
          startingClient: false
        });
        cache._queueRequest(deferred, stashQueueOptions);
        cache._queueRequest(deferred, retrieveQueueOptions);
      });
      it('should attempt to start client ', function() {
        expect(getStub).to.be.calledTwice();
        expect(cache._retrieve).to.be.calledOnce();
        expect(cache._stash).to.be.calledOnce();


      });
    });

    describe('when startingClient fails', function() {
      beforeEach(function() {
        getStub = sandbox.stub().yields('ERROR');
        cache._retrieve = sandbox.stub();
        cache._stash = sandbox.stub();
        cache.__set__({
          cacheClient: {
            start: getStub
          },
          startingClient: false
        });
        cache._queueRequest(deferred, stashQueueOptions);
        cache._queueRequest(deferred, retrieveQueueOptions);

      });
      it('should attempt to start client ', function() {
        expect(getStub).to.be.calledTwice();
        expect(cache._retrieve).to.not.be.called();
        expect(cache._stash).to.not.be.called();
      });
    });


    describe('when startingClient is true', function() {
      beforeEach(function() {
        getStub = sandbox.stub().yields(null, 'RESULT');
        cache.__set__({
          cacheClient: {
            start: getStub
          },
          startingClient: true


        });
        cache._queueRequest(deferred, stashQueueOptions);

      });
      it('should  not attempt to start client ', function() {
        expect(getStub).to.not.be.called();
      });
    });

  });

  describe('_addCallToQueue', function() {
    var addToQueueOptions = {
      method: 'stash',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };
    var addToQueueOptionsRetrive = {
      method: 'retrieve',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };

    describe('when Client is not initialised', function() {
      beforeEach(function() {
        cache.__set__('cacheClient', '');

      });
      it('should reject with an error ', function() {
        expect(cache._addCallToQueue(addToQueueOptions)).to.be.rejectedWith('Cache not initialised');
      });

    });

    describe('when client is not ready', function() {
      beforeEach(function() {
        getStub = sandbox.stub().returns(false);

        cache.__set__({
          cacheClient: {
            isReady: getStub
          }
        });
        cache._queueRequest = sandbox.stub();
        cache._addCallToQueue(addToQueueOptions);

      });

      it('should queue requests ', function() {
        expect(cache._queueRequest).to.be.calledOnce();
      });
    });

    describe('when client is ready', function() {
      beforeEach(function() {
        getStub = sandbox.stub().returns(true);

        cache.__set__({
          cacheClient: {
            isReady: getStub
          }
        });
        cache._stash = sandbox.stub();
        cache._retrieve = sandbox.stub();
        cache._queueRequest = sandbox.stub();


        cache._addCallToQueue( addToQueueOptions);
        cache._addCallToQueue(addToQueueOptionsRetrive);

      });

      it('should queue requests ', function() {
        expect(cache._queueRequest).to.not.be.called();
        expect(cache._stash).to.be.calledOnce();
        expect(cache._retrieve).to.be.calledOnce();


      });
    });

  });

  describe('set', function() {
    var expectedOptions = {
      method: 'stash',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };
    beforeEach(function() {
      cache._addCallToQueue = sandbox.stub();

      cache.set( {
        segment: 'test',
        key: 'foo',
        value: 'bar'
      });
    });
    it('should call the _addCallToQueue function', function(){
      expect(cache._addCallToQueue).to.be.calledOnce();
      expect(cache._addCallToQueue).to.be.calledWith(expectedOptions);
    });



  });
  describe('get', function() {
    var expectedOptions = {
      method: 'retrieve',
      segment: 'test',
      key: 'foo',
      value: 'bar'
    };
    beforeEach(function() {
      cache._addCallToQueue = sandbox.stub();

      cache.get({
        segment: 'test',
        key: 'foo',
        value: 'bar'
      });

    });
    it('should call the _addCallToQueue function', function(){
      expect(cache._addCallToQueue).to.be.calledOnce();
      expect(cache._addCallToQueue).to.be.calledWith(expectedOptions);

    });

  });
  describe('delete', function() {
    describe('when redis SCAN is successful', function() {
      beforeEach(function() {
        cache.__set__('partition', 'revolver');
        cache._delete = sandbox.stub();
        redisWrapperStub = sandbox.stub(redisWrapper, 'scan', function() {
          return Q.resolve();
        });


      });

      it('should get the keys using redis scan and call the _delete function', function(){
        return cache.delete({
          segment: 'test',
          key: 'foo',
          value: 'bar'
        }).then(function(){
          expect(redisWrapperStub).to.be.calledOnce();
          expect(cache._delete).to.be.calledOnce();

        });

      });
    });
    describe('when redis SCAN errors', function() {
      beforeEach(function() {
        cache.__set__('partition', 'revolver');
        cache._delete = sandbox.stub();
        redisWrapperStub = sandbox.stub(redisWrapper, 'scan', function() {
          return Q.reject();
        });


      });

      it('cache drop will be unsuccessful', function(){
        return cache.delete({
          segment: 'test',
          key: 'foo',
          value: 'bar'
        }).then(function(){
          expect(redisWrapperStub).to.be.calledOnce();
          expect(cache._delete).to.not.have.been.called();

        });

      });
    });
  });
});
