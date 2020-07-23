'use strict';

const mongoose = require('mongoose');
require('./mongoose_models/student');

const {generateMongooseModelsSpec} = require('../../lib/mongoose.js');

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
      const mongooseModels = mongoose.modelNames();
      const mongooseModelSpecs = generateMongooseModelsSpec(mongooseModels);
      return mongooseModels.map(model => {
        const modelSpec = mongooseModelSpecs[model];
        /* Not asserting the spec itself, trusting mongoose-to-swagger :) */
        return expect(modelSpec).toBeDefined();
      });
      
    });
  });
});