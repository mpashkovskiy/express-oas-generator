'use strict';

const {convertOpenApiVersionToV3} = require('../../lib/openapi.js');

describe('openapi.js', () => {

  describe('convertOpenApiVersionToV3()', () => {
    it('WHEN openapi v2 spec is invalid THEN should throw exception', () => {
      convertOpenApiVersionToV3({}, (err, specV3) => {
        expect(err).toBeDefined();
        expect(specV3).toBeUndefined();
      }); 
    });
  });
});