const m2s = require('mongoose-to-swagger'); 

module.exports.generateMongooseModelsSpec = mongooseModelNames => {
  try {
    /* Disabling because its a peer dependency */
    /* eslint-disable global-require */
    /* @ts-ignore */
    const mongoose = require('mongoose');

    const mongooseModelSpecs = mongooseModelNames.map(m => m2s(mongoose.model(m)));
    
    return mongooseModelSpecs.reduce((parsedMongooseModelSpecs, modelSpec) => {
      parsedMongooseModelSpecs[modelSpec.title] = modelSpec;
      return parsedMongooseModelSpecs;
    }, {});

  
  } catch (err) {
    throw new Error(`${err.message}`);
  }
};
  