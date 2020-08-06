const openApiVersionConverter = require('swagger2openapi');

module.exports.convertOpenApiVersionToV3 = (specV2, callback) => {
  let options = {patch: true, warnOnly: true};
        
  openApiVersionConverter.convertObj(specV2, options, function(err, results) {
    if (err) {
      throw new Error(`Could not convert to Open Api V3 because of ${err.message}`);
    }

    callback(results.openapi);
  });
};