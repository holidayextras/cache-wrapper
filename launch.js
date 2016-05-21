/* jslint node: true */
'use strict';

// get Elephant and frickin use it!
var cacheWrapper = require( './index' );


cacheWrapper.initialise( {
  "host": "localhost",
  "port": "6379",
  "partition": "cacheWrapper" 
}, [ {
  segment: 'foo',
  expiresIn: 10000
} ] ).then( function() {
  cacheWrapper.set( {
    segment: 'foo',
    key: 'kev:hodges:1',
    value: 'baz'
  } ).then( function() {

    cacheWrapper.set( {
      segment: 'foo',
      key: 'kev:hodges:2',
      value: 'also baz'
    } ).then( function() {

      cacheWrapper.set( {
        segment: 'foo',
        key: 'kev:nugget:1',
        value: 'nuggets'
      } ).then( function() {

        cacheWrapper.delete( {
          segment: 'foo',
          prefix: 'kev:hodges:'
        } ).then( function() {

          cacheWrapper.get( {
            segment: 'foo',
            key: 'kev:hodges:1'
          } ).then( console.log );

          cacheWrapper.get( {
            segment: 'foo',
            key: 'kev:hodges:2'
          } ).then( console.log );

          cacheWrapper.get( {
            segment: 'foo',
            key: 'kev:nugget:1'
          } ).then( console.log );

        } );
      } );

    } );


    
   
  } ).fail( console.log );
} ).fail( console.log );


// cacheWrapper.initialise( {
//   "host": "localhost",
//   "port": "6379",
//   "partition": "cahceWrapper" 
// }, [ {
//   segment: 'foo',
//   expiresIn: 10000
// } ] ).then( function() {
//   cacheWrapper.set( {
//     segment: 'foo',
//     key: 'bar',
//     value: 'baz'
//   } ).then( function() {
//     cacheWrapper.get( {
//       segment: 'foo',
//       key: 'bar'
//     } ).then( console.log );
//     cacheWrapper.get( {
//       segment: 'foo',
//       key: 'bar'
//     } ).then( console.log );
//     cacheWrapper.get( {
//       segment: 'foo',
//       key: 'bar'
//     } ).then( console.log );
//   } ).fail( console.log );
// } ).fail( console.log );
