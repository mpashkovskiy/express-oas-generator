const _ = require('lodash');
const swaggerUi = require('swagger-ui-express');
const packageInfo = require(process.cwd() + '/package.json');
const generateSchema = require('generate-schema');

let app;
let spec = {};

function sortObject(o) {
    var sorted = {}, key, a = [];
    for (key in o) {
        if (o.hasOwnProperty(key)) {
            a.push(key);
        }
    }
    a.sort();
    for (key = 0; key < a.length; key++) {
        sorted[a[key]] = o[a[key]];
    }
    return sorted;
}

function getType(obj) {
    if (isNaN(obj)) {
        return ({}).toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
    }

    if ((obj + '').indexOf('.') !== -1) {
        return 'float';
    }

    return 'integer';
}

function init(predefinedSpec) {
    predefinedSpec = predefinedSpec || {};
    spec = {info: {}, paths: {}, schemes: [], securityDefinitions: {}};

    app._router.stack.forEach(router => {
        const stack = router.handle.stack;
        if (!stack) {
            return;
        }

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
                    consumes: [],
                    produces: [],
                    responses: {},
                    security: [],
                    parameters: params.map(p => {
                        return {
                            'name': p,
                            'in': 'path',
                            'required': true,
                        };
                    }) || []
                };
                // if (methods.length > 1) {
                //   let parts = path.split('/');
                //   const tag = parts[parts.length - 1].startsWith('{') ? parts[parts.length - 2] : parts[parts.length - 1];
                //   spec.paths[path][m].tags = [tag];
                // }
            })
        })
    });

    if (packageInfo.name) {
        spec.info.title = packageInfo.name;
    }
    if (packageInfo.version) {
        spec.info.version = packageInfo.version;
    }
    if (packageInfo.license) {
        spec.info.license = {name: packageInfo.license};
    }
    spec.info.description = '[Specification JSON](/api-spec)';
    if (packageInfo.description) {
        spec.info.description = '\n\n' + packageInfo.description;
    }
    spec = sortObject(_.merge(spec, predefinedSpec));
    app.use('/api-spec', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(spec, null, 2));
    });
    app.use('/api-docs', swaggerUi.serve, (req, res) => {
        swaggerUi.setup(spec)(req, res);
    });
}

function updateSchemes(req) {
    const schema = req.connection.encrypted ? 'https' : 'http';
    if (spec.schemes.indexOf(schema) === -1) {
        spec.schemes.push(schema);
    }
}


function getPathKey(req) {
    if (spec.paths[req.url]) {
        return req.url;
    }

    var url = req.url.split('?')[0];
    var pathKeys = Object.keys(spec.paths);
    for (let i = 0; i < pathKeys.length; i++) {
        const pathKey = pathKeys[i];
        if (url.match(pathKey.replace(/{([^\/]+)}/g, '(?:([^\\\\/]+?))') + '\/?$')) {
            return pathKey;
        }
    }
    return undefined;
}

function processPath(req, method, pathKey) {
    if (pathKey.indexOf('{') === -1) {
        return;
    }

    let pathRegexp = pathKey.replace(/{([^\/]+)}/g, '(.+)?');
    const matches = req.url.match(pathRegexp);

    if (!matches) {
        return;
    }

    let i = 1;
    method.parameters.forEach(p => {
        if (p.in === 'path') {
            p.type = getType(matches[i]);
            p.example = matches[i];
            i++;
        }
    });
}

function processHeaders(req, method) {
    const contentType = req.headers['content-type'].split(';')[0];
    if (method.consumes.indexOf(contentType) === -1) {
        method.consumes.push(contentType);
    }
    Object
        .keys(req.headers)
        .filter(h => h === 'authorization' || h.startsWith('x-'))
        .forEach(h => {
            if (h === 'authorization') {
                method.responses[401] = {description: 'Unauthorized'};
            }

            if (method.security.map(s => Object.keys(s)[0]).indexOf(h) === -1) {
                let obj = {};
                obj[h] = []
                method.security.push(obj);
            }

            spec.securityDefinitions[h] = {
                'name': h,
                'in': 'header',
                'type': 'apiKey'
            }
        });
}

function fillExamples(schema, vals) {
    for (let prop in schema.properties) {
        if (schema.properties[prop].type === 'object') {
            fillExamples(schema.properties[prop], vals[prop]);
        } else {
            schema.properties[prop].example = (prop === 'password') ? '******' : vals[prop];
        }
    }
}

function getSchema(body) {
    const schema = generateSchema.json(body);
    delete schema['$schema'];
    fillExamples(schema, body);
    return schema;
}

function processBody(req, method) {
    if (!req.body || Object.keys(req.body).length === 0) {
        return;
    }

    method.parameters.push({
        'in': 'body',
        'name': 'body',
        'required': true,
        'schema': getSchema(req.body)
    });
}

function processQuery(req, method) {
    let params = req.query;
    if (!params) {
        return;
    }

    const props = generateSchema.json(params).properties;
    for (let p in props) {
        if (method.parameters.map(p => p.name).indexOf(p) !== -1) {
            continue;
        }

        let param = props[p];
        param.name = p;
        param.in = 'query';
        param.example = params[p];
        // param.description = p.indexOf('_') !== -1 ? p.split('_').join(' ') : p.replace(/([A-Z])/g, ' $1').toLowerCase();
        // let obj = {};
        // obj[p] = params[p];
        // param.description = 'Example: ' + querystring.stringify(obj);
        if (param.type === 'array') {
            param.collectionFormat = 'multi';
        } else if (param.type === 'string') {
            param.type = getType(params[p]);
        }
        method.parameters.push(param);
    }
}

function processResponse(res, method) {
    var oldWrite = res.write;
    var oldEnd = res.end;
    var chunks = [];

    res.write = function (chunk) {
        if (!method.responses[this.statusCode]) {
            chunks.push(new Buffer(chunk));
        }
        oldWrite.apply(res, arguments);
    };

    res.end = function (chunk) {
        const contentType = this.get('content-type').split(';')[0];
        if (method.produces.indexOf(contentType) === -1) {
            method.produces.push(contentType);
        }
        if (!method.responses[this.statusCode]) {
            if (chunk) {
                chunks.push(new Buffer(chunk));
            }
            method.responses[this.statusCode] = {};
            if ((this.statusCode + '').startsWith('20')) {
                method.responses[this.statusCode].description = 'successful operation';
            }
            if (contentType.indexOf('json') !== -1) {
                const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
                method.responses[this.statusCode].schema = getSchema(body);
            }
        }
        oldEnd.apply(res, arguments);
    };
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

    return {method: spec.paths[pathKey][m], pathKey: pathKey};
}

module.exports = {
    init: (aApp, predefinedSpec) => {
        app = aApp;

        // middleware to handle responses
        app.use((req, res, next) => {
            try {
                const methodAndPathKey = getMethod(req);
                if (methodAndPathKey) {
                    processResponse(res, methodAndPathKey.method);
                }
            } catch (err) {}
            return next();
        });

        setTimeout(() => {
            // middleware to handle requests
            app.use((req, res, next) => {
                try {
                    const methodAndPathKey = getMethod(req);
                    if (methodAndPathKey) {
                        const method = methodAndPathKey.method;
                        updateSchemes(req);
                        processPath(req, method, methodAndPathKey.pathKey);
                        processHeaders(req, method);
                        processBody(req, method);
                        processQuery(req, method);
                    }
                } catch (err) {}
                return next();
            });
            init(predefinedSpec);
        }, 2000);
    }
};
