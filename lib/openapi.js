const openApiVersionConverter = require('swagger2openapi');

module.exports.convertOpenApiVersionToV3 = (specV2, callback) => {
  const options = {patch: true, warnOnly: true};
        
  openApiVersionConverter.convertObj(specV2, options, function(err, results) {
    callback(err, results && results.openapi);
  });
};