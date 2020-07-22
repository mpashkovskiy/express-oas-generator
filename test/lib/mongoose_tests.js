'use strict';

const {generateMongooseModelsSpec} = require('../../lib/mongoose.js');
require('./mongoose_models/student');

describe('mongoose.js', () => {

  describe('generateMongooseModelsSpec()', () => {
    it('WHEN supplied mongoose model does not exist THEN should throw exception', () => {
      const mongooseModels = ['User', 'Student'];
    
      try {
        generateMongooseModelsSpec(mongooseModels);
        throw new Error();
      } catch (err) {
        expect(err.message).toContain(`Schema hasn't been registered for model "${mongooseModels.shift()}"`);
      }
    });

    it('WHEN mongoose model exists THEN it should generate the model spec', () => {
      const mongooseModels = ['Student'];
    
      const mongooseModelSpecs = generateMongooseModelsSpec(mongooseModels);
      const studentModelSpec = mongooseModelSpecs[mongooseModels.shift()];
      /* Not asserting the spec itself, trusting mongoose-to-swagger :) */
      expect(studentModelSpec).toBeDefined();
    });
  });
});