'use strict';

const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('./lib/mongoose_models/student');
const generator = require('../index.js');
const { versions } = require('../lib/openapi');
let { logger } = require('../lib/logger');

const MS_TO_STARTUP = 2000;
const port = 8888;
const ERROR_RESPONSE_CODE = 500;
const BASE_PATH = '/api/v1';
const ERROR_PATH = '/error';
const PLAIN_TEXT_RESPONSE = 'whatever';

it('WHEN patch function is provided THEN it is applied to spec', done => {
  const path = '/hello';
  const newTitle = 'New title';
  const newValue = 2;
  const app = express();
  generator.init(app, function(spec) {
    spec.info.title = newTitle;
    if (spec.paths[path] && spec.paths[path].get.parameters[0]) {
      spec.paths[path].get.parameters[0].example = newValue;
    }
    return spec;
  });
  app.get(path, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });
  app.set('port', port);
  const server = app.listen(app.get('port'), function() {
    setTimeout(() => {
      request.get(`http://localhost:${port}${path}?a=1`, () => {
        const spec = generator.getSpec();
        expect(spec.info.title).toBe(newTitle);
        expect(spec.info.description).toContain(`(/api-spec/${versions.OPEN_API_V2})`);
        expect(spec.info.description).toContain(`(/api-spec/${versions.OPEN_API_V3})`);
        expect(spec.paths[path].get.parameters[0].example).toBe(newValue);
        server.close();
        done();
      });
    }, MS_TO_STARTUP);
  });
});

describe('index.js', () => {

  let server;
  const middleware = (req, res, next) => {
    res.status(200).send({ result: 'OK' });
    return next();
  };
  const errorMiddleware = (error, req, res, next) => {
    if (!error) {
      return next();
    }
    res.status(ERROR_RESPONSE_CODE).send(error);
    return undefined;
  };

  beforeAll(done => {
    const app = express();
    
    generator.init(app, {});

    app.use(bodyParser.json({}));
    app.get('/hello', (req, res) => {
      res.setHeader('Content-Type', 'text/plain');
      return res.end(PLAIN_TEXT_RESPONSE);
    });
    app.post('/hello2', (req, res, next) => {
      res.setHeader('Content-Type', 'application/json');
      res.send({key: 'secret'});
      next();
    });
    app.use('/should_not_be_handled', middleware);
    let router = express.Router();
    router.get('/success/:param/router', middleware);
    router.get('/success-no-param', middleware);
    router.get(ERROR_PATH, (req, res, next) => next({ error: 'error' }));
    app.use(BASE_PATH, router);
    app.use(errorMiddleware);
    app.set('port', port);
    server = app.listen(app.get('port'));
    setTimeout(done, MS_TO_STARTUP);
  });

  beforeEach(done => {
    let spec = generator.getSpec();
    generator.getSpecV3((err, specV3) => {
      expect(err).toBeNull();
      expect(Object.keys(spec.paths).length).toBe(5);
      request.get(`http://localhost:${port}/api-spec`, (error, specV2res) => {
        expect(JSON.parse(specV2res.body)).toEqual(spec);
        request.get(`http://localhost:${port}/api-spec/v3`, (error, specV3res) => {
          expect(JSON.parse(specV3res.body)).toEqual(specV3);
          done();
        });
      });
    });
  });

  afterAll(() => {
    // console.info(JSON.stringify(generator.getSpec(), null, 2));
    server.close();
  });

  it('WHEN making GET request to endpoint returning plain text THEN schema filled properly', done => {
    const path = '/hello';
    request.get(`http://localhost:${port}${path}`, () => {
      const method = generator.getSpec().paths[path].get;
      expect(method.produces).toEqual(['text/plain']);
      expect(method.summary).toEqual(path);
      expect(method.responses[200].schema.type).toEqual('string');
      expect(method.responses[200].schema.example).toEqual(PLAIN_TEXT_RESPONSE);
      done();
    });
  });

  it('WHEN making POST request to routerless endpoint THEN body is documented', done => {
    const path = '/hello2';
    const postData = {'foo': 'bar'};
    request({
      url: `http://localhost:${port}${path}`,
      method: 'POST',
      headers: {'content-type' : 'application/json'},
      body: JSON.stringify(postData)
    }, () => {
      const method = generator.getSpec().paths[path].post;
      ['consumes', 'produces'].forEach(el =>
        expect(method[el]).toEqual(['application/json'])
      );
      expect(method.summary).toEqual(path);
      const bodyParam = method.parameters[0];
      expect(bodyParam.in).toEqual('body');
      expect(bodyParam.schema.properties.foo.type).toEqual('string');
      done();
    });
  });

  it('WHEN making success requests THEN path should be filled with request and response schema', done => {
    const param = 1;
    const path = `${BASE_PATH}/success/${param}/router`;
    request.get(`http://localhost:${port}${path}`, () => {
      const spec = generator.getSpec();
      expect(spec.host).toEqual(`localhost:${port}`);
      expect(spec.schemes).toEqual(['http']);

      const expressPath = path.replace('/' + param, '/{param}');
      const specPath = spec.paths[expressPath];
      expect(specPath).toBeDefined();
      expect(Object.keys(specPath)).toEqual(['get']);
      expect(specPath.get.parameters.length).toBe(1);

      const method = specPath.get;
      ['consumes', 'produces'].forEach(el =>
        expect(method[el]).toEqual(['application/json'])
      );

      const bodyParam = method.parameters[0];
      expect(bodyParam.name).toBe('param');
      expect(bodyParam.in).toBe('path');
      expect(bodyParam.type).toBe('integer');
      expect(bodyParam.required).toBeTruthy();
      expect(bodyParam.example).toBe(param);


      const responses = method.responses;
      expect(Object.keys(responses)).toEqual(['200']);
      const schema = responses['200'].schema;
      expect(schema.type).toBe('object');
      expect(schema.properties.result.type).toBe('string');
      expect(schema.properties.result.example).toBe('OK');

      done();
    });
  });

  it('WHEN getting request with Authorization and X-* headers THEN security parts should be filled', done => {
    const path = `${BASE_PATH}/success-no-param`;
    const options = {
      url: `http://localhost:${port}/${path}`,
      headers: {
        'Authorization': 'Bearer 123',
        'X-Header': '123'
      }
    };
    request(options, () => {
      const spec = generator.getSpec();
      const specPath = spec.paths[path].get;
      expect(specPath.security.map(s => Object.keys(s)[0])).toEqual(Object.keys(options.headers).map(h => h.toLowerCase()));
      expect(Object.keys(spec.securityDefinitions)).toEqual(Object.keys(options.headers).map(h => h.toLowerCase()));
      for (let def in spec.securityDefinitions) {
        expect(spec.securityDefinitions[def]).toEqual({
          'type': 'apiKey',
          'name': def.toLowerCase(),
          'in': 'header'
        });
      }
      done();
    });
  });

  it('WHEN making error request THEN error response should be added to path', done => {
    const path = BASE_PATH + ERROR_PATH;
    request.get(`http://localhost:${port}${path}`, () => {
      const response = generator.getSpec().paths[path].get.responses[ERROR_RESPONSE_CODE];
      expect(response).toBeDefined();
      expect(response.schema.properties.error).toBeDefined();
      done();
    });
  });

});

it('WHEN package json includes baseUrlPath THEN spec description is updated', done => {
  generator.setPackageInfoPath('test/specs/withBaseUrlPath');
  generator.init(express(), {});

  setTimeout(() => {
    const spec = generator.getSpec();
    expect(spec.basePath !== undefined).toBeTruthy();
    expect(spec.info.description).toContain(`(${spec.basePath}/api-spec/${versions.OPEN_API_V2})`);
    expect(spec.info.description).toContain(`(${spec.basePath}/api-spec/${versions.OPEN_API_V3})`);
    expect(spec.info.description).toContain(`(${spec.basePath})`);
    expect(spec.info.description).toContain('Base url');

    done();
  }, MS_TO_STARTUP);
});


it('WHEN package json does not include baseUrlPath THEN spec description is not updated', done => {
  generator.setPackageInfoPath('test/specs/withoutBaseUrlPath');
  generator.init(express(), {});

  setTimeout(() => {
    const spec = generator.getSpec();
    expect(spec.basePath === undefined).toBeTruthy();
    expect(spec.info.description).toContain(`(/api-spec/${versions.OPEN_API_V2})`);
    expect(spec.info.description).toContain(`(/api-spec/${versions.OPEN_API_V3})`);
    expect(spec.info.description).not.toContain('base url');
    done();
  }, MS_TO_STARTUP);
});

it('WHEN custom path for docs set THEN the the path should provide it', done => {
  const app = express();
  const path = '/';
  generator.init(
    app,
    spec => spec,
    'api-spec.json',
    1000,
    'custom-docs'
  );
  
  app.get(path, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });
  app.set('port', port);
  const server = app.listen(app.get('port'), () => {
    setTimeout(() => {
      request.get(`http://localhost:${port}/custom-docs`, (error, response) => {
        expect(error).toBeNull();
        expect(response.statusCode).toBe(200);
        server.close();
        done();
      });
    }, MS_TO_STARTUP);
  });
});

it('WHEN no custom path for docs set THEN the default path should be provided', done => {
  const app = express();
  const path = '/';
  generator.init(app);
  app.get(path, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });
  app.set('port', port);
  const server = app.listen(app.get('port'), () => {
    setTimeout(() => {
      request.get(`http://localhost:${port}/api-docs`, (error, response) => {
        expect(error).toBeNull();
        expect(response.statusCode).toBe(200);
        server.close();
        done();
      });
    }, MS_TO_STARTUP);
  });
});

it('WHEN mongoose models are supplied THEN the definitions and tags should be included', done => {
  const app = express();
  const mongooseModels = mongoose.modelNames();
  
  generator.init(
    app,
    spec => spec,
    'api-spec.json',
    1000,
    'custom-docs',
    mongooseModels
  );

  const tag = mongooseModels.shift();
  const path = `/${tag}`;
  
  app.get(path, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });
  app.set('port', port);
  const server = app.listen(app.get('port'), () => {
    setTimeout(() => {
      request.get(`http://localhost:${port}/api-spec`, (error, response) => {
        const spec = JSON.parse(response.body); 
        mongoose.modelNames().map(model => {
          return expect(spec.definitions[model]).toBeDefined(); 
        });

        expect(spec.tags.find(t => t.name === tag)).toBeDefined();

        const method = spec.paths[path].get;
        expect(method.tags).toEqual([tag]);
        server.close();
        done();
      });
    }, MS_TO_STARTUP);
  });
});

it('WHEN node environment is undefined THEN it should log warning ', () => {
  const app = express();
  const loggerSpy = spyOn(logger, 'warn').and.callThrough();
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  delete process.env.NODE_ENV;
  generator.handleResponses(app);
  generator.handleRequests();
  expect(loggerSpy).toHaveBeenCalled();
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

it('WHEN node environment is ignored THEN it should not generate or serve api docs/spec ', done => {
  const app = express();
  const PRODUCTION_NODE_ENV = 'production';
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  process.env.NODE_ENV = PRODUCTION_NODE_ENV;

  const PATH = '/path';

  app.get(PATH, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });

  generator.handleResponses(app, {
    ignoredNodeEnvironments: [PRODUCTION_NODE_ENV]
  });
  generator.handleRequests();

  app.set('port', port);
  const server = app.listen(app.get('port'), () => {
    request.get(`http://localhost:${port}/api-spec`, (error, responseApiSpec) => {
      expect(responseApiSpec.statusCode).toEqual(404);
      
      request.get(`http://localhost:${port}/api-docs`, (error, responseApiDocs) => {
        expect(responseApiDocs.statusCode).toEqual(404);
        
        request.get(`http://localhost:${port}${PATH}`, () => {
          expect(generator.getSpec().paths[PATH]).toBeUndefined();
          
          process.env.NODE_ENV = ORIGINAL_NODE_ENV;
          server.close();
          done();
        });
      });
    });
  });
});

it('WHEN node environment is ignored but always serve docs is enabled THEN it should not generate but serve api docs/spec ', done => {
  const app = express();
  const PRODUCTION_NODE_ENV = 'production';
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  process.env.NODE_ENV = PRODUCTION_NODE_ENV;

  const PATH = '/path';

  app.get(PATH, (req, res, next) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send(PLAIN_TEXT_RESPONSE);
    return next();
  });

  generator.handleResponses(app, {
    ignoredNodeEnvironments: [PRODUCTION_NODE_ENV],
    alwaysServeDocs: true
  });
  generator.handleRequests();

  app.set('port', port);
  const server = app.listen(app.get('port'), () => {
    request.get(`http://localhost:${port}${PATH}`, () => {
      request.get(`http://localhost:${port}/api-spec`, (error, responseApiSpec) => {    
        const spec = JSON.parse(responseApiSpec.body);
        expect(spec.paths[PATH].get.parameters).toEqual([]);
        expect(spec.paths[PATH].get.responses).toEqual({});
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
        server.close();
        done();
      });
    });
  });
});

it('WHEN **request** middleware is injected before **response** middleware THEN an error should be thrown', done => {
  /**
   * @note make sure that the global variables are reset
   * after every test
   */

  expect(() => generator.handleRequests()).toThrowError();
  done();
});

it('WHEN middleware order is correct THEN no errors should be thrown', done => {
  const app = express();

  expect(() => {
    try {
      generator.handleResponses(app, {});
      generator.handleRequests();
    } catch (err) {
      /**
	   * this should NOT happen, but if it does - log the error & let it bubble
	   */

      // eslint-disable-next-line no-console
      console.error(err);
      throw err;
    }
  }).not.toThrowError();

  done();
});
