const openApiVersionConverter = require('swagger2openapi');

module.exports.versions = {
  OPEN_API_V2:'v2',
  OPEN_API_V3:'v3'
};

module.exports.getSpecByVersion = (specV2, version, callback) => {
  const defaultSpec = (specV2, callback) => callback(null, specV2);
  const availableSpecs = {
    [this.versions.OPEN_API_V2]: defaultSpec, 
    [this.versions.OPEN_API_V3]: this.convertOpenApiVersionToV3,
  };
  const specByVersion = availableSpecs[version] || defaultSpec;

  return specByVersion(specV2, callback);
};

module.exports.convertOpenApiVersionToV3 = (specV2, callback) => {
  const options = {patch: true, warnOnly: true};
        
  openApiVersionConverter.convertObj(specV2, options, function(err, results) {
    callback(err, results && results.openapi);
  });
};