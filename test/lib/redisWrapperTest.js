'use strict';
var sinon = require('sinon');
var sandbox = sinon.sandbox.create();
var expect = require('chai')
  .use(require('dirty-chai'))
  .use(require('chai-as-promised'))
  .use(require('sinon-chai'))
  .expect;
var rewire = require('rewire');
var redisMock = require('redis-mock');
var redisWrapper = rewire('../../lib/redisWrapper');
redisWrapper.__set__({
  redis: redisMock
});
var getStub;
var serverConfig = {
  partition: 'test'
};

var options = {
  partition: 'test',
  segment: 'test:test',
  prefix: 'testPrefix'
};
var expectedOptions = {
  partition: 'test',
  segment: 'test:test',
  prefix: 'testPrefix',
  keys: ['key1', 'key2']
};
var result;
describe('redisWrapper', function() {
  afterEach(function() {
    sandbox.restore();
  });
  describe('initialise', function() {
    describe('when server config is not passed ', function() {
      beforeEach(function() {
        result = redisWrapper.initialise();
      });
      it('rejects the promise', function() {
        return expect(result).to.be.rejectedWith('no serverConfig passed');
      });
    });
    describe('when server config is passed and redis client is available ', function() {
      beforeEach(function() {
        result = redisWrapper.initialise(serverConfig);
      });
      it('initialises the redis client successfully', function() {
        return expect(result).to.be.fulfilled();
      });
    });

  });

  describe('scan', function() {
    describe('when required options is not passed ', function() {
      it('rejects the promise', function() {
        expect(redisWrapper.scan({})).to.be.rejectedWith('Required options not passed in');
        expect(redisWrapper.scan(serverConfig)).to.be.rejectedWith('Required options not passed in');
        expect(redisWrapper.scan({
          segment: 'test:test'
        })).to.be.rejectedWith('Required options not passed in');

      });
    });

    describe('when required options is passed and redisClient does not error', function() {
      beforeEach(function() {
        getStub = sandbox.stub().yieldsTo(null, null, [['testing'], ['test:test%3Atest:key1', 'test:test%3Atest:key2'] ]);
        redisWrapper.__set__({
          redisClient: {
            scan: getStub
          }
        });
      });
      it('returns with the keys that match the prefix', function() {
        return redisWrapper.scan(options)
          .then(function(resultOptions) {
            expect(getStub).to.be.calledOnce();
            expect(resultOptions).to.deep.equal(expectedOptions);
          });
      });
    });

    describe('when required options is passed and redisClient errors', function() {
      beforeEach(function() {
        getStub = sandbox.stub().yieldsTo(null, 'error');
        redisWrapper.__set__({
          redisClient: {
            scan: getStub
          }
        });
      });
      it('returns with the keys that match the prefix', function() {
        return redisWrapper.scan(options)
          .fail(function() {
            expect(getStub).to.be.calledOnce();
          });
      });
    });
  });
});
