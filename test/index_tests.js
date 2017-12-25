'use strict';

const express = require('express');
const request = require('request');
const generator = require('../index.js');

const MS_TO_STARTUP = 2000;
const port = 8080;

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
    res.status(500).send(error);
    return undefined;
  };

  beforeAll(done => {
    const app = express();
    generator.init(app, {});
    app.use('/success', middleware);
    let router = express.Router();
    router.get('/success/:param/router', middleware);
    app.use('/api/vi', router);
    app.use('/error', (req, res, next) => next({ error: 'error' }));
    // TODO add endpoint with Authorization header
    app.use(errorMiddleware);
    app.set('port', port);
    server = app.listen(app.get('port'));
    setTimeout(done, MS_TO_STARTUP);
  });

  beforeEach(done => {
    let spec = generator.getSpec();
    expect(Object.keys(spec.paths).length).toBe(3);
    request.get(`http://localhost:${port}/api-spec`, (error, res) => {
      expect(JSON.parse(res.body)).toEqual(spec);
      done();
    });
  });

  afterAll(() => server.close());

  it('success requests', done => {
    const param = 1;
    const path = `/api/vi/success/${param}/router`;
    request.get(`http://localhost:${port}${path}`, () => {
      const spec = generator.getSpec();
      expect(spec.host).toEqual(`localhost:${port}`);
      expect(spec.schemes).toEqual(['http']);

      const expressPath = path.replace('1', '{param}');
      const specPath = spec.paths[expressPath];
      expect(specPath).not.toBe(undefined);
      expect(Object.keys(specPath)).toEqual(['get']);
      expect(specPath.get.parameters.length).toBe(1);

      const method = specPath.get;
      ['consumes', 'produces'].forEach(el => expect(method[el]).toEqual(['application/json']));

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

  // it('failing requests', done => {
  //   request.get(`http://localhost:${port}/error`, (error, res) => {
  //     done();
  //   });
  // });

});