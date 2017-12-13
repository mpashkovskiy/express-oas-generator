const _ = require('lodash');
const swaggerUi = require('swagger-ui-express');
const packageInfo = require(process.cwd() + '/package.json');
const generateSchema = require('generate-schema')

let app;
let spec = {};

function sortObject(o) {
    var sorted = {}, key, a = [];
    for (key in o) if (o.hasOwnProperty(key)) a.push(key);
    a.sort();
    for (key = 0; key < a.length; key++) sorted[a[key]] = o[a[key]];
    return sorted;
}

function toType(obj) {
    if (isNaN(obj))
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();

    if (obj.indexOf('.') !== -1)
        return 'float';

    return 'integer';
}

function init(predefinedSpec) {
    predefinedSpec = predefinedSpec || {};
    spec = {info: {}, paths: {}};

    app._router.stack.forEach(router => {
        const stack = router.handle.stack;
        if (!stack)
            return;

        let prefix = router.regexp + '';
        prefix = prefix.substr(2, prefix.indexOf('?(?') - 3).replace(/\\/g, '');
        stack.forEach(route => {
            let params = [];
            let path = prefix + route.route.path;
            const matches = path.match(/:([^\/]+)/g);
            if (matches) {
                matches.forEach(found => {
                    const paramName = found.substr(1);
                    path = path.replace(found, '{' + paramName + '}');
                    params.push(paramName);
                });
            }
            spec.paths[path] = {};
            let methods = Object.keys(route.route.methods).filter(m => route.route.methods[m] === true && !m.startsWith('_'));
            methods.forEach(m => {
                m = m.toLowerCase();
                spec.paths[path][m] = {
                    consumes: ['application/json'],
                    produces: ['application/json'],
                    parameters: params.map(p => {
                        // const description = p.indexOf('_') !== -1 ? p.split('_').join(' ') : p.replace(/([A-Z])/g, ' $1').toLowerCase();
                        return {
                            'name': p,
                            'in': 'path',
                            'required': true,
                            // 'description': description
                        };
                    })
                };
                // if (methods.length > 1) {
                //     let parts = path.split('/');
                //     const tag = parts[parts.length - 1].startsWith('{') ? parts[parts.length - 2] : parts[parts.length - 1];
                //     spec.paths[path][m].tags = [tag];
                // }
            })
        })
    });

    if (packageInfo.name)        spec.info.title = packageInfo.name;
    if (packageInfo.version)     spec.info.version = packageInfo.version;
    if (packageInfo.license)     spec.info.license = {name: packageInfo.license};
    if (packageInfo.description) spec.info.description = packageInfo.description;
    spec.info.description += '\n\n[Specification JSON](/api-spec)';
    spec = sortObject(_.merge(spec, predefinedSpec));
    app.use('/api-spec', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(spec, null, 2));
    });
    app.use('/api-docs', swaggerUi.serve, (req, res) => {
        swaggerUi.setup(spec)(req, res);
    });
}

module.exports = {
    init: (aApp, predefinedSpec) => {
        app = aApp;
        app.use(function(req, res, next) {
            if (req.url.startsWith('/api-'))
                return next();

            const m = req.method.toLowerCase();
            if (m === 'options')
                return next();

            spec.schemes = spec.schemes || [];
            const schema = req.connection.encrypted ? 'https' : 'http';
            if (spec.schemes.indexOf(schema) === -1) {
                spec.schemes.push(schema);
            }

            let pathKey = req.url;
            if (spec.paths[pathKey] === undefined) {
                let path = req.route.path.replace(/:([^\/]+)/g, '{$1}');
                const pathArr = Object.keys(spec.paths).filter(key => key.indexOf(path) !== -1);
                pathKey = pathArr ? pathArr[0] : undefined;
            }

            if (!pathKey)
                return next();

            let method = spec.paths[pathKey][m];
            method.responses = method.responses || {};
            method.responses[res.statusCode] = {description: ''};
            Object.keys(req.headers)
                  .filter(h => h === 'authorization' || h.startsWith('x-'))
                  .forEach(h => {
                      if (h === 'authorization') {
                          method.responses[401] = {description: 'Unauthorized'};
                      }

                      method.security = method.security || [];
                      if (method.security.map(s => Object.keys(s)[0]).indexOf(h) === -1) {
                          let obj = {};
                          obj[h] = []
                          method.security.push(obj);
                      }

                      spec.securityDefinitions = spec.securityDefinitions || {};
                      spec.securityDefinitions[h] = {
                          'name': h,
                          'in': 'header',
                          'type': 'apiKey'
                      }
                  });
            if (req.body && Object.keys(req.body).length > 0) {
                method.parameters = method.parameters || [];
                const schema = generateSchema.json(req.body);
                delete schema['$schema'];
                method.parameters.push({
                    'in': 'body',
                    'name': 'body',
                    'required': true,
                    'schema': schema
                });
            }
            let params = req.query;
            if (!params)
                return next();

            method.parameters = method.parameters || [];
            for (let p in params) {
                if (method.parameters.map(p => p.name).indexOf(p) !== -1)
                    continue;

                // const description = p.indexOf('_') !== -1 ? p.split('_').join(' ') : p.replace(/([A-Z])/g, ' $1').toLowerCase();
                let param = {
                    'name': p,
                    'in': 'query',
                    'type': toType(params[p]),
                    // 'description': description
                };
                if (param.type === 'array') {
                    param.items = { type: toType(params[p][0]) };
                    param.collectionFormat = 'multi';
                }
                method.parameters.push(param);
            }
            return next();
        });
        init(predefinedSpec);
    }
};
