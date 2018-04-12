'use strict';

const express = require('express');
const request = require('request');
const generator = require('../index.js');

const MS_TO_STARTUP = 2000;
const port = 8080;
const ERROR_RESPONSE_CODE = 500;
const BASE_PATH = '/api/v1';
const ERROR_PATH = '/error';

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
    app.post( '/hello', (req, res) => {
      res.setHeader('Content-Type', 'text/plain');
      return res.end('whatever');
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
    expect(Object.keys(spec.paths).length).toBe(4);
    request.get(`http://localhost:${port}/api-spec`, (error, res) => {
      expect(JSON.parse(res.body)).toEqual(spec);
      done();
    });
  });

  afterAll(() => server.close());

  it('WHEN making success requests THEN path should be filled with request and response schema', done => {
    const param = 1;
    const path = `${BASE_PATH}/success/${param}/router`;
    request.get(`http://localhost:${port}${path}`, () => {
      const spec = generator.getSpec();
      expect(spec.host).toEqual(`localhost:${port}`);
      expect(spec.schemes).toEqual(['http']);

      const expressPath = path.replace('/1', '/{param}');
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