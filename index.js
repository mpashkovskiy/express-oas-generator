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
let predefinedSpec;
let spec = {};
let lastRecordTime = new Date().getTime();

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
    spec.info.description = '[Specification JSON]('+packageInfo.baseUrlPath +'/api-spec) , base url : ' + packageInfo.baseUrlPath;
  } else {
    packageInfo.baseUrlPath = '';
    spec.info.description = '[Specification JSON]('+packageInfo.baseUrlPath +'/api-spec)';
  }

  if (packageInfo.description) {
    spec.info.description += `\n\n${packageInfo.description}`;
  }

}

function init() {
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
      };
    });
  });

  updateSpecFromPackage();
  spec = patchSpec(predefinedSpec);
  app.use(packageInfo.baseUrlPath + '/api-spec', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(patchSpec(predefinedSpec), null, 2));
    return next();
  });
  app.use(packageInfo.baseUrlPath + '/api-docs', swaggerUi.serve, (req, res) => {
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

module.exports.init = (aApp, aPredefinedSpec, aPath, aWriteInterval) => {
  app = aApp;
  predefinedSpec = aPredefinedSpec;
  const writeInterval = aWriteInterval | 10 * 1000;

  // middleware to handle responses
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);
      if (methodAndPathKey && methodAndPathKey.method) {
        processors.processResponse(res, methodAndPathKey.method);
      }
      const ts = new Date().getTime();
      if (aPath && ts - lastRecordTime > writeInterval) {
        lastRecordTime = ts;
        fs.writeFile(aPath, JSON.stringify(spec, null, 2), 'utf8', err => {
          const fullPath = path.resolve(aPath);
          if (err) {
            throw new Error(`Cannot store the specification into ${fullPath} because of ${err.message}`);
          }
        });
      }
    } finally {
      return next();
    }
  });

  // make sure we list routes after they are configured
  setTimeout(() => {
    // middleware to handle requests
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
      } finally {
        return next();
      }
    });
    init();
  }, 1000);
};

module.exports.getSpec = () => {
  return patchSpec(predefinedSpec);
};

module.exports.setPackageInfoPath = pkgInfoPath => {
  packageJsonPath = `${process.cwd()}/${pkgInfoPath}/package.json`;
};
