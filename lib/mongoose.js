/* eslint-disable global-require */
module.exports.generateMongooseModelsSpec = mongooseModelNames => {
  /* Disabling because its a peer dependency */
  const mongoose = require('mongoose');
  const m2s = require('mongoose-to-swagger'); 

  const mongooseModelSpecs = mongooseModelNames.map(m => m2s(mongoose.model(m)));

  return mongooseModelSpecs.reduce((parsedMongooseModelSpecs, modelSpec) => {
    parsedMongooseModelSpecs[modelSpec.title] = modelSpec;
    return parsedMongooseModelSpecs;
  }, {});
};
  