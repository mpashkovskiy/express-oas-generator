const _ = require('lodash');
const swaggerUi = require('swagger-ui-express');
const utils = require('./lib/utils');
const processors = require('./lib/processors');

const packageInfo = require(`${process.cwd()}/package.json`);

let app;
let spec = {};

function updateSpecFromPackage() {
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

  spec.info.description = '[Specification JSON](/api-spec)';
  if (packageInfo.description) {
    spec.info.description += `\n\n${packageInfo.description}`;
  }
}

function init(predefinedSpec) {
  spec = { swagger: '2.0', paths: {}};
  app._router.stack.forEach(router => {
    const stack = router.handle.stack;
    if (!stack) {
      return; 
    }

    let prefix = `${router.regexp}`;
    prefix = prefix.substr(2, prefix.indexOf('?(?') - 3).replace(/\\/g, '');
    stack.forEach(route => {
      const params = [];
      let path = prefix + route.route.path;
      const matches = path.match(/:([^\/]+)/g);
      if (matches) {
        matches.forEach(found => {
          const paramName = found.substr(1);
          path = path.replace(found, `{${paramName}}`);
          params.push(paramName);
        });
      }

      spec.paths[path] = {};
      const methods = Object.keys(route.route.methods).filter(m => route.route.methods[m] === true && !m.startsWith('_'));
      methods.forEach(m => {
        m = m.toLowerCase();
        spec.paths[path][m] = {
          consumes: ['application/json'],
          parameters: params.map(p => ({
            name: p,
            in: 'path',
            required: true,
          })) || [],
        };
      });
    });
  });

  updateSpecFromPackage();
  spec = utils.sortObject(_.merge(spec, predefinedSpec || {}));
  app.use('/api-spec', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(spec, null, 2));
    return next();
  });
  app.use('/api-docs', swaggerUi.serve, (req, res) => {
    swaggerUi.setup(spec)(req, res);
  });
}

function getPathKey(req) {
  if (spec.paths[req.url]) {
    return req.url; 
  }

  const url = req.url.split('?')[0];
  const pathKeys = Object.keys(spec.paths);
  for (let i = 0; i < pathKeys.length; i += 1) {
    const pathKey = pathKeys[i];
    if (url.match(`${pathKey.replace(/{([^\/]+)}/g, '(?:([^\\\\/]+?))')}\/?$`)) {
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

module.exports.init = (aApp, predefinedSpec) => {
  app = aApp;

  // middleware to handle responses
  app.use((req, res, next) => {
    try {
      const methodAndPathKey = getMethod(req);
      if (methodAndPathKey) {
        processors.processResponse(res, methodAndPathKey.method); 
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
        if (methodAndPathKey) {
          const method = methodAndPathKey.method;
          spec.schemes = spec.schemes || [];
          if (spec.schemes.indexOf(req.protocol) === -1) {
            spec.schemes.push(req.protocol);
          }
          if (!spec.host) {
            spec.host = res.req.get('host');
          }

          processors.processPath(req, method, methodAndPathKey.pathKey);
          processors.processHeaders(req, method, spec);
          processors.processBody(req, method);
          processors.processQuery(req, method);
        }
      } finally {
        return next();
      }
    });
    init(predefinedSpec);
  }, 1000);
};

module.exports.getSpec = () => spec;
