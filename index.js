/**
 * @fileOverview main file
 * @module index
 */

require('./index');

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const utils = require('./lib/utils');
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

  if (packageInfo.baseUrlPath) {
    spec.info.description = '[Specification JSON](' + packageInfo.baseUrlPath + '/api-spec) , base url : ' + packageInfo.baseUrlPath;
  } else {
    packageInfo.baseUrlPath = '';
    spec.info.description = '[Specification JSON](' + packageInfo.baseUrlPath + '/api-spec)';
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
    endpoint.methods.forEach(m => {
      spec.paths[path][m.toLowerCase()] = {
        summary: path,
        consumes: ['application/json'],
        parameters: params.map(p => ({
          name: p,
          in: 'path',
          required: true,
        })) || [],
        responses: {}
      };
    });
  });

  updateSpecFromPackage();
  spec = patchSpec(predefinedSpec);
  app.use(packageInfo.baseUrlPath + '/api-spec', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(patchSpec(predefinedSpec), null, 2));
    next();
  });
  app.use(packageInfo.baseUrlPath + '/' + swaggerUiServePath, swaggerUi.serve, (req, res) => {
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
      ? utils.sortObject(_.merge(spec, predefinedSpec || {}))
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
 * Apply this **first**!
 *
 * (straight after creating the express app (as the very first middleware))
 *
 * @description apply the `response` middleware.
 *
 * @type { typeof import('./index').handleResponses }
*/
function handleResponses(expressApp, options = { swaggerUiServePath: 'api-docs', specOutputPath: undefined, predefinedSpec: {}, writeIntervalMs: 1000 * 10 }) {
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
 * Apply this **last**!
 *
 * (as the very last middleware of your express app)
 *
 * @description apply the `request` middleware
 * Applies to the `app` you provided in `handleResponses`
 *
 * Also, since this is the last function you'll need to invoke,
 * it also initializes the specification and serves the api documentation.
 * The options are for these tasks.
 *
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
 * @warn it's preferred that you use `handleResponses`,
 * `handleRequests` and `serveApiDocs` **individually**
 * and not directly from this `init` function,
 * because we need `handleRequests` to be placed as the
 * very last middleware and we cannot guarantee this here,
 * since we're only using an arbitrary setTimeout of `1000` ms.
 *
 * See
 * https://github.com/mpashkovskiy/express-oas-generator/pull/32#issuecomment-546807216
 *
 * @description initialize the `express-oas-generator`.
 *
 * This will apply both `handleResponses` and `handleRequests`
 * and also will call `serveApiDocs`.
 *
 * @type { typeof import('./index').init }
 */
function init(aApp, aPredefinedSpec = {}, aSpecOutputPath = undefined, aWriteInterval = 1000 * 10, aSwaggerUiServePath = 'api-docs') {
  handleResponses(aApp, {
    swaggerUiServePath: aSwaggerUiServePath,
    specOutputPath: aSpecOutputPath,
    predefinedSpec: aPredefinedSpec,
    writeIntervalMs: aWriteInterval,
  });
  setTimeout(() => {
    handleRequests();
  }, 1000);
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
