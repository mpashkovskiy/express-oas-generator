/**
 * @fileOverview main file
 * @module index
 */

require('./index');

const _merge = require('lodash.merge');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const utils = require('./lib/utils');
const { generateMongooseModelsSpec } = require('./lib/mongoose');
const { generateTagsSpec, matchingTags } = require('./lib/tags');
const processors = require('./lib/processors');
const listEndpoints = require('express-list-endpoints');

const WRONG_MIDDLEWARE_ORDER_ERROR = `
Express oas generator:

you miss-placed the **response** and **request** middlewares!

Please, make sure to:

1. place the RESPONSE middleware FIRST,
right after initializing the express app,

2. and place the REQUEST middleware LAST,
inside the app.listen callback

For more information, see https://github.com/mpashkovskiy/express-oas-generator#Advanced-usage-recommended
`;

let packageJsonPath = `${process.cwd()}/package.json`;
let packageInfo;
let app;

/**
 * @param {function|object} predefinedSpec either the Swagger specification
 * or a function with one argument producing it.
 */
let swaggerUiServePath;
let predefinedSpec;
let spec = {};
let lastRecordTime = new Date().getTime();
let firstResponseProcessing = true;
let mongooseModelsSpecs;
let tagsSpecs;

/**
 * @param {boolean} [responseMiddlewareHasBeenApplied=false]
 *
 * @note make sure to reset this variable once you've done your checks.
 *
 * @description used make sure the *order* of which the middlewares are applied is correct
 *
 * The `response` middleware MUST be applied FIRST,
 * before the `request` middleware is applied.
 *
 * We'll use this to make sure the order is correct.
 * If not - we'll throw an informative error.
 */
let responseMiddlewareHasBeenApplied = false;

/**
 *
 */
function updateSpecFromPackage() {

  /* eslint global-require : off */
  packageInfo = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};

  spec.info = spec.info || {};

  if (packageInfo.name) {
    spec.info.title = packageInfo.name;
  }
  if (packageInfo.version) {
    spec.info.version = packageInfo.version;
  }
  if (packageInfo.license) {
    spec.info.license = { name: packageInfo.license };
  }

  spec.info.description = '[Specification JSON](' + packageInfo.baseUrlPath + '/api-spec)';
  if (packageInfo.baseUrlPath) {
    spec.basePath = packageInfo.baseUrlPath;
    spec.info.description = ', base url: ' + packageInfo.baseUrlPath;
  } else {
    packageInfo.baseUrlPath = '';
  }

  if (packageInfo.description) {
    spec.info.description += `\n\n${packageInfo.description}`;
  }

}

/**
 * @description serve the openAPI docs with swagger at a specified path / url
 *
 * @returns void
 */
function serveApiDocs() {
  spec = { swagger: '2.0', paths: {} };

  const endpoints = listEndpoints(app);
  endpoints.forEach(endpoint => {
    const params = [];
    let path = endpoint.path;
    const matches = path.match(/:([^/]+)/g);
    if (matches) {
      matches.forEach(found => {
        const paramName = found.substr(1);
        path = path.replace(found, `{${paramName}}`);
        params.push(paramName);
      });
    }

    if (!spec.paths[path]) {
      spec.paths[path] = {};
    }

    spec.tags = tagsSpecs || [];

    endpoint.methods.forEach(m => {
      spec.paths[path][m.toLowerCase()] = {
        summary: path,
        consumes: ['application/json'],
        parameters: params.map(p => ({
          name: p,
          in: 'path',
          required: true,
        })) || [],
        responses: {},
        tags: matchingTags(tagsSpecs || [], path)
      };
    });
  });

  spec.definitions = mongooseModelsSpecs || {};
  updateSpecFromPackage();
  spec = patchSpec(predefinedSpec);
  app.use(packageInfo.baseUrlPath + '/api-spec', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(patchSpec(predefinedSpec), null, 2));
    next();
  });
  app.use(packageInfo.baseUrlPath + '/' + swaggerUiServePath, swaggerUi.serve, (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    swaggerUi.setup(patchSpec(predefinedSpec))(req, res);
  });
}

/**
 *
 * @param predefinedSpec
 * @returns {{}}
 */
function patchSpec(predefinedSpec) {
  return !predefinedSpec
    ? spec
    : typeof predefinedSpec === 'object'
      ? utils.sortObject(_merge(spec, predefinedSpec || {}))
      : predefinedSpec(spec);
}

/**
 *
 * @param req
 * @returns {string|undefined|*}
 */
function getPathKey(req) {
  if (!req.url) {
    return undefined;
  }

  if (spec.paths[req.url]) {
    return req.url;
  }

  const url = req.url.split('?')[0];
  const pathKeys = Object.keys(spec.paths);
  for (let i = 0; i < pathKeys.length; i += 1) {
    const pathKey = pathKeys[i];
    if (url.match(`${pathKey.replace(/{([^/]+)}/g, '(?:([^\\\\/]+?))')}/?$`)) {
      return pathKey;
    }
  }
  return undefined;
}

/**
 *
 * @param req
 * @returns {{method: *, pathKey: *}|undefined}
 */
function getMethod(req) {
  if (req.url.startsWith('/api-')) {
    return undefined;
  }

  const m = req.method.toLowerCase();
  if (m === 'options') {
    return undefined;
  }

  const pathKey = getPathKey(req);
  if (!pathKey) {
    return undefined;
  }

  return { method: spec.paths[pathKey][m], pathKey };
}

/**
 *
 * @param req
 */
function updateSchemesAndHost(req) {
  spec.schemes = spec.schemes || [];
  if (spec.schemes.indexOf(req.protocol) === -1) {
    spec.schemes.push(req.protocol);
  }
  if (!spec.host) {
    spec.host = req.get('host');
  }
}

/**
 * @description Generates definitions spec from mongoose models
 */
function updateDefinitionsSpec(mongooseModels) {
  const validMongooseModels = Array.isArray(mongooseModels) && mongooseModels.length > 0;
  
  if (validMongooseModels && !mongooseModelsSpecs) {
    mongooseModelsSpecs = generateMongooseModelsSpec(mongooseModels);
  }
}

/**
 * @description Generates tags spec
 */
function updateTagsSpec(tags) {
  const validTags = tags && Array.isArray(tags) && tags.length > 0;

  if (validTags && !tagsSpecs) {
    tagsSpecs = generateTagsSpec(tags);
  }
}

/**
 * @type { typeof import('./index').handleResponses }
*/
function handleResponses(expressApp, 
  options = { 
    swaggerUiServePath: 'api-docs', 
    specOutputPath: undefined, 
    predefinedSpec: {}, 
    writeIntervalMs: 1000 * 10, 
    mongooseModels: [], 
    tags: undefined
  }) {
  responseMiddlewareHasBeenApplied = true;

  /**
   * save the `expressApp` to our local `app` variable.
   * Used here, but not in `handleRequests`,
   * because this comes before it.
   */
  app = expressApp;
  swaggerUiServePath = options.swaggerUiServePath || 'api-docs';
  predefinedSpec = options.predefinedSpec || {};
  const { specOutputPath, writeIntervalMs } = options;

  updateDefinitionsSpec(options.mongooseModels);
  updateTagsSpec(options.tags || options.mongooseModels);

  /** middleware to handle RESPONSES */
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);
      if (methodAndPathKey && methodAndPathKey.method) {
        processors.processResponse(res, methodAndPathKey.method);
      }

      const ts = new Date().getTime();
      if (firstResponseProcessing || specOutputPath && ts - lastRecordTime > writeIntervalMs) {
        firstResponseProcessing = false;
        lastRecordTime = ts;

        fs.writeFile(specOutputPath, JSON.stringify(spec, null, 2), 'utf8', err => {
          const fullPath = path.resolve(specOutputPath);

          if (err) {
            /**
			 * TODO - this is broken - the error will be caught and ignored in the catch below.
			 * See https://github.com/mpashkovskiy/express-oas-generator/pull/39#discussion_r340026645
			 */
            throw new Error(`Cannot store the specification into ${fullPath} because of ${err.message}`);
          }
        });
      }
    } catch (e) {
      /** TODO - shouldn't we do something here? */
    } finally {
      /** always call the next middleware */
      next();
    }
  });
}

/**
 * @type { typeof import('./index').handleRequests }
 */
function handleRequests() {
  /** make sure the middleware placement order (by the user) is correct */
  if (responseMiddlewareHasBeenApplied !== true) {
    throw new Error(WRONG_MIDDLEWARE_ORDER_ERROR);
  }

  /** everything was applied correctly; reset the global variable. */
  responseMiddlewareHasBeenApplied = false;

  /** middleware to handle REQUESTS */
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);
      if (methodAndPathKey && methodAndPathKey.method && methodAndPathKey.pathKey) {
        const method = methodAndPathKey.method;
        updateSchemesAndHost(req);
        processors.processPath(req, method, methodAndPathKey.pathKey);
        processors.processHeaders(req, method, spec);
        processors.processBody(req, method);
        processors.processQuery(req, method);
      }
    } catch (e) {
      /** TODO - shouldn't we do something here? */
    } finally {
      next();
    }
  });

  /** forward options to `serveApiDocs`: */
  serveApiDocs();
}

/**
 * TODO
 *
 * 1. Rename the parameter names
 * (this will require better global variable naming to allow re-assigning properly)
 *
 * 2. the `aPath` is ignored only if it's `undefined`,
 * but if it's set to an empty string `''`, then the tests fail.
 * I think we should be checking for falsy values, not only `undefined` ones.
 *
 * 3. (Breaking) Use object for optional parameters:
 * https://github.com/mpashkovskiy/express-oas-generator/issues/35
 *
 */
/**
 * @type { typeof import('./index').init }
 */
function init(aApp, aPredefinedSpec = {}, aSpecOutputPath = undefined, aWriteInterval = 1000 * 10, aSwaggerUiServePath = 'api-docs', aMongooseModels = [], aTags = undefined) {
  handleResponses(aApp, {
    swaggerUiServePath: aSwaggerUiServePath,
    specOutputPath: aSpecOutputPath,
    predefinedSpec: aPredefinedSpec,
    writeIntervalMs: aWriteInterval,
    mongooseModels: aMongooseModels,
    tags: aTags
  });
  setTimeout(() => {
    handleRequests();
  }, 1000);
  
  updateDefinitionsSpec(aMongooseModels);
  updateTagsSpec(aTags || aMongooseModels);
}

/**
 * @type { typeof import('./index').getSpec }
 */
const getSpec = () => {
  return patchSpec(predefinedSpec);
};

/**
 * @type { typeof import('./index').setPackageInfoPath }
 *
 * @param pkgInfoPath  path to package.json
 */
const setPackageInfoPath = pkgInfoPath => {
  packageJsonPath = `${process.cwd()}/${pkgInfoPath}/package.json`;
};

module.exports = {
  handleResponses,
  handleRequests,
  init,
  getSpec,
  setPackageInfoPath
};
