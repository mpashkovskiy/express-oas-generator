const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const utils = require('./lib/utils');
const processors = require('./lib/processors');
const listEndpoints = require('express-list-endpoints');

let packageJsonPath = `${process.cwd()}/package.json`;
let packageInfo;
let app;

/**
 * @param {function|object} predefinedSpec either the Swagger specification
 * or a function with one argument producing it.
 */
let predefinedSpec;
let spec = {};
let lastRecordTime = new Date().getTime();

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
 * @param {object} options
 * @param {string} [options.path=api-docs] where to serve the openAPI docs. Defaults to `api-docs`
 * @param {*} [options.predefinedSpec=undefined]
 *
 * @returns void
 */
function serveApiDocs(options = { path: 'api-docs', predefinedSpec: undefined }) {
  const { path, predefinedSpec } = options;

  const aApiDocsPath = path;
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
  app.use(packageInfo.baseUrlPath + '/' + aApiDocsPath, swaggerUi.serve, (req, res) => {
    swaggerUi.setup(patchSpec(predefinedSpec))(req, res);
  });
}

function patchSpec(predefinedSpec) {
  return typeof predefinedSpec === 'object'
    ? utils.sortObject(_.merge(spec, predefinedSpec || {}))
    : predefinedSpec(spec);
}

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

function updateSchemesAndHost(req) {
  spec.schemes = spec.schemes || [];
  if (spec.schemes.indexOf(req.protocol) === -1) {
    spec.schemes.push(req.protocol);
  }
  if (!spec.host) {
    spec.host = req.get('host');
  }
}

/** TODO - type defs for Express don't work (I tried @external) */
/**
 * Apply this **first**!
 *
 * (straight after creating the express app (as the very first middleware))
 *
 * @description `response` middleware.
 *
 * @param {Express} expressApp - the express app
 *
 * @param {Object} [options] optional configuration options
 * @param {string|undefined} [options.pathToOutputFile=undefined] where to write the openAPI specification to.
 * Specify this to create the openAPI specification file.
 * @param {number} [options.writeIntervalMs=10000] how often to write the openAPI specification to file
 *
 * @returns void
 */
function injectResponseMiddleware(expressApp, options = { pathToOutputFile: undefined, writeIntervalMs: 1000 * 10 }) {
  responseMiddlewareHasBeenApplied = true;

  /**
   * save the `expressApp` to our local `app` variable.
   * Used here, but not in `injestRequestMiddleware`,
   * because this comes before it.
   */
  app = expressApp;

  const { pathToOutputFile, writeIntervalMs } = options;

  /** middleware to handle RESPONSES */
  // eslint-disable-next-line complexity
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);

      if (methodAndPathKey && methodAndPathKey.method) {
        processors.processResponse(res, methodAndPathKey.method);
      }

      let firstTime = true; /** run instantly the first time. TODO do not set set `lastRecordTime` at the start until we run */
      const ts = new Date().getTime();

      if (firstTime || pathToOutputFile && ts - lastRecordTime > writeIntervalMs) {
        firstTime = false;
        lastRecordTime = ts;

        fs.writeFile(pathToOutputFile, JSON.stringify(spec, null, 2), 'utf8', err => {
          const fullPath = path.resolve(pathToOutputFile);

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

/** TODO - type defs for Express don't work (I tried @external) */
/**
 * Apply this **last**!
 *
 * (as the very last middleware of your express app)
 *
 * @description `request` middleware.
 * Applies to the `app` you provided in `injectResponseMiddleware`
 *
 * @returns void
 */
function injectRequestMiddleware() {
  /** make sure the middleware placement order (by the user) is correct */
  if (responseMiddlewareHasBeenApplied !== true) {
    const wrongMiddlewareOrderError = `
Express oas generator:

you miss-placed the **response** and **request** middlewares!

Please, make sure to:

1. place the RESPONSE middleware FIRST,
right after initializing the express app,

2. and place the REQUEST middleware LAST,
inside the app.listen callback

For more information, see https://github.com/mpashkovskiy/express-oas-generator#Advanced-usage-recommended
	`;

    throw new Error(wrongMiddlewareOrderError);
  }

  /** everything was applied correctly; reset the global variable. */
  responseMiddlewareHasBeenApplied = false;

  /** middleware to handle REQUESTS */
  // eslint-disable-next-line complexity
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
 * @warn it's preferred that you use `injectResponseMiddleware`,
 * `injectRequestMiddleware` and `serveApiDocs` **individually**
 * and not directly from this `init` function,
 * because we need `injectRequestMiddleware` to be placed as the
 * very last middleware and we cannot guarantee this here,
 * since we're only using an arbitrary setTimeout of `1000` ms.
 *
 * See
 * https://github.com/mpashkovskiy/express-oas-generator/pull/32#issuecomment-546807216
 *
 * @description initialize the `express-oas-generator`.
 *
 * This will apply both `injectResponseMiddleware` and `injectRequestMiddleware`
 * and also will call `serveApiDocs`.
 *
 * @param {Express} aApp - the express app
 * @param {*} [aPredefinedSpec=undefined]
 * @param {string|undefined} [aPath=undefined] where to write the openAPI specification to.
 * Specify this to create the openAPI specification file.
 * @param {number} [aWriteInterval=10000] how often to write the openAPI specification to file
 * @param {string} [aApiDocsPath=api-docs] where to serve the openAPI docs. Defaults to `api-docs`
 */
function init(aApp, aPredefinedSpec = undefined, aPath = undefined, aWriteInterval = 1000 * 10, aApiDocsPath = 'api-docs') {
  /**
   * TODO - shouldn't `predefinedSpec` be assigned @ `serveApiDocs`?
   *
   * I don't know if the `predefinedSpec` is used anywhere for `injectResponseMiddleware`
   * and before `injectRequestMiddleware` is called
   */
  predefinedSpec = aPredefinedSpec;

  injectResponseMiddleware(aApp, { pathToOutputFile: aPath, writeIntervalMs: aWriteInterval });

  /**
   * make sure we list routes after they are configured
   *
   * TODO - this (setTimeout) is error-prone.
   * See https://github.com/mpashkovskiy/express-oas-generator/pull/32#issuecomment-546807216
   *
   * There could be some heavylifing initialization that takes
   * more than a second and in those cases the requests processing middleware
   * wouldn't be the last one.
   */
  setTimeout(() => {
    injectRequestMiddleware();
    serveApiDocs({ path: aApiDocsPath, predefinedSpec });
  }, 1000);
}

const getSpec = () => {
  return patchSpec(predefinedSpec);
};

const setPackageInfoPath = pkgInfoPath => {
  packageJsonPath = `${process.cwd()}/${pkgInfoPath}/package.json`;
};

module.exports = {
  injectResponseMiddleware,
  injectRequestMiddleware,
  init,
  getSpec,
  setPackageInfoPath
};
