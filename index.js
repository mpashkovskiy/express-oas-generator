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
const { convertOpenApiVersionToV3, getSpecByVersion, versions } = require('./lib/openapi');
const processors = require('./lib/processors');
const listEndpoints = require('express-list-endpoints');
const { logger } = require('./lib/logger');

const DEFAULT_SWAGGER_UI_SERVE_PATH = 'api-docs';
const DEFAULT_IGNORE_NODE_ENVIRONMENTS = ['production'];

const UNDEFINED_NODE_ENV_ERROR = ignoredNodeEnvironments => `WARNING!!! process.env.NODE_ENV is not defined.\
To disable the module set process.env.NODE_ENV to any of the supplied ignoredNodeEnvironments: ${ignoredNodeEnvironments.join()}`;

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
let mongooseModelsSpecs;
let tagsSpecs;
let ignoredNodeEnvironments;
let serveDocs;
let specOutputPath;

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

  packageInfo.baseUrlPath = packageInfo.baseUrlPath || '';
  const v2link = `[${versions.OPEN_API_V2}](${packageInfo.baseUrlPath}/api-spec/${versions.OPEN_API_V2})`;
  const v3link = `[${versions.OPEN_API_V3}](${packageInfo.baseUrlPath}/api-spec/${versions.OPEN_API_V3})`;
  spec.info.description = `Specification JSONs: ${v2link}, ${v3link}.`;
  if (packageInfo.baseUrlPath !== '') {
    spec.basePath = packageInfo.baseUrlPath;
    spec.info.description += ` Base url: [${packageInfo.baseUrlPath}](${packageInfo.baseUrlPath})`;
  }

  if (packageInfo.description) {
    spec.info.description += `\n\n${packageInfo.description}`;
  }

}

/**
 * @description Builds api spec middleware
 *
 * @returns Middleware
 */
function apiSpecMiddleware(version) {
  return (req, res) => {
    getSpecByVersion(spec, version, (err, openApiSpec) => {
      if (!err) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(openApiSpec, null, 2));
      }
    });
  };
}

/**
 * @description Builds swagger serve middleware
 * @param version Available open api versions: 'v2' (default if empty) or 'v3'.
 * @returns Middleware
 */
function swaggerServeMiddleware(version) {
  return (req, res) => {
    getSpecByVersion(spec, version, (err, openApiSpec) => {
      if (!err) {
        res.setHeader('Content-Type', 'text/html');
        swaggerUi.setup(openApiSpec)(req, res);
      }
    });
  };
}

/**
 * @description Applies spec middlewares
 * @param version Available open api versions: 'v2' (default if empty) or 'v3'.
 */
function applySpecMiddlewares(version = '') {
  const apiSpecBasePath = packageInfo.baseUrlPath.concat('/api-spec');
  const baseSwaggerServePath = packageInfo.baseUrlPath.concat('/' + swaggerUiServePath);

  app.use(apiSpecBasePath.concat('/' + version), apiSpecMiddleware(version));
  app.use(baseSwaggerServePath.concat('/' + version), swaggerUi.serve, swaggerServeMiddleware(version));
}

/**
 * @description Prepares spec to be served
 *
 * @returns void
 */
function prepareSpec() {
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
}

/**
 * @description serve the openAPI docs with swagger at a specified path / url
 *
 * @returns void
 */
function serveApiDocs() {
  prepareSpec();

  applySpecMiddlewares(versions.OPEN_API_V2);
  
  applySpecMiddlewares(versions.OPEN_API_V3);

  // Base path middleware should be applied after specific versions
  applySpecMiddlewares(); 
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
  if (!req.url || spec.paths[req.url]) {
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
 * @description Persists OpenAPI content to spec output file
 */
function writeSpecToOutputFile() {
  if (specOutputPath) {
    fs.writeFileSync(specOutputPath, JSON.stringify(spec, null, 2), 'utf8');

    convertOpenApiVersionToV3(spec, (err, specV3) => {
      if (!err) {
        const parsedSpecOutputPath = path.parse(specOutputPath);
        const {name, ext} = parsedSpecOutputPath;
        parsedSpecOutputPath.base = name.concat('_').concat(versions.OPEN_API_V3).concat(ext);
        
        const v3Path = path.format(parsedSpecOutputPath);
        
        fs.writeFileSync(v3Path, JSON.stringify(specV3), 'utf8');
      }
      /** TODO - Log that open api v3 could not be generated */
    });  

  }
}

/**
 * @type { typeof import('./index').handleResponses }
*/
function handleResponses(expressApp, 
  options = { 
    swaggerUiServePath: DEFAULT_SWAGGER_UI_SERVE_PATH, 
    specOutputPath: undefined, 
    predefinedSpec: {}, 
    writeIntervalMs: 0, 
    mongooseModels: [], 
    tags: undefined,
    ignoredNodeEnvironments: DEFAULT_IGNORE_NODE_ENVIRONMENTS,
    alwaysServeDocs: undefined,
  }) {

  ignoredNodeEnvironments = options.ignoredNodeEnvironments || DEFAULT_IGNORE_NODE_ENVIRONMENTS;
  const isEnvironmentIgnored = ignoredNodeEnvironments.includes(process.env.NODE_ENV);
  serveDocs = options.alwaysServeDocs;
  
  if (serveDocs === undefined) {
    serveDocs = !isEnvironmentIgnored;
  }
  
  if (!process.env.NODE_ENV) {
    logger.warn(UNDEFINED_NODE_ENV_ERROR(ignoredNodeEnvironments));
  }
  
  /**
   * save the `expressApp` to our local `app` variable.
   * Used here, but not in `handleRequests`,
   * because this comes before it.
   */
  app = expressApp;
  swaggerUiServePath = options.swaggerUiServePath || DEFAULT_SWAGGER_UI_SERVE_PATH;
  predefinedSpec = options.predefinedSpec || {};
  specOutputPath = options.specOutputPath;
  
  updateDefinitionsSpec(options.mongooseModels);
  updateTagsSpec(options.tags || options.mongooseModels);
  
  if (isEnvironmentIgnored) {
    return;
  }
  
  responseMiddlewareHasBeenApplied = true;

  /** middleware to handle RESPONSES */
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);
      if (methodAndPathKey && methodAndPathKey.method) {
        processors.processResponse(res, methodAndPathKey.method, () => {
          writeSpecToOutputFile();
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
  
  const isIgnoredEnvironment = ignoredNodeEnvironments.includes(process.env.NODE_ENV);
  if (serveDocs || !isIgnoredEnvironment) {      
    /** forward options to `serveApiDocs`: */
    serveApiDocs();
  }

  if (isIgnoredEnvironment) {
    return;
  }
  
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
        writeSpecToOutputFile();
      }
    } catch (e) {
      /** TODO - shouldn't we do something here? */
    } finally {
      next();
    }
  });
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
function init(aApp, aPredefinedSpec = {}, aSpecOutputPath = undefined, aWriteInterval = 0, aSwaggerUiServePath = DEFAULT_SWAGGER_UI_SERVE_PATH, aMongooseModels = [], aTags = undefined, aIgnoredNodeEnvironments = DEFAULT_IGNORE_NODE_ENVIRONMENTS, aAlwaysServeDocs = undefined) {
  handleResponses(aApp, {
    swaggerUiServePath: aSwaggerUiServePath,
    specOutputPath: aSpecOutputPath,
    predefinedSpec: aPredefinedSpec,
    writeIntervalMs: aWriteInterval,
    mongooseModels: aMongooseModels,
    tags: aTags,
    ignoredNodeEnvironments: aIgnoredNodeEnvironments,
    alwaysServeDocs: aAlwaysServeDocs
  });
  setTimeout(() => handleRequests(), 1000);
}

/**
 * @type { typeof import('./index').getSpec }
 */
const getSpec = () => {
  return patchSpec(predefinedSpec);
};

/**
 * @type { typeof import('./index').getSpecV3 }
 */
const getSpecV3 = callback => {
  convertOpenApiVersionToV3(getSpec(), callback);
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
  getSpecV3,
  setPackageInfoPath
};
