'use strict';

const processors = require('../../lib/processors.js');

describe('processors.js', () => {

  describe('processPath()', () => {
    it('WHEN path with placehoder is provided THEN sets param type and example', () => {
      const b = 'asd';
      const d = 2;
      const req = { url: `/a/${b}/c/${d}` };
      const param2 = {'name': 'e', 'in': 'body'};
      let method = {
        parameters: [
          {'name': 'b', 'in': 'path'},
          {'name': 'd', 'in': 'path'},
          param2,
        ]
      };
      const pathKey = '/a/{b}/c/{d}';
      processors.processPath(req, method, pathKey);
      expect(method.parameters[0].type).toBe('string');
      expect(method.parameters[0].example).toBe(b);
      expect(method.parameters[1].type).toBe('integer');
      expect(method.parameters[1].example).toBe(d);
      expect(method.parameters[2]).toBe(param2);
    });

    it('WHEN path has no parameters THEN sets of params remains the same', () => {
      const req = { url: '/a/b' };
      let method = { parameters: [] };
      const pathKey = '/a/b';
      processors.processPath(req, method, pathKey);
      expect(method.parameters).toEqual([]);
    });
  });

  it('WHEN request with auth and x- header is provided THEN processHeaders() sets method security obj and securityDefinition', () => {
    const headers = ['Authorization', 'X-Header'];
    let req = { headers: {} };
    headers.forEach(h => {
      req.headers[h] = {};
    });
    let spec = {};
    let method = {};
    processors.processHeaders(req, method, spec);
    expect(method.security.map(s => Object.keys(s)[0])).toEqual(headers);
    expect(Object.values(spec.securityDefinitions)).toEqual(headers.map(h => ({
      name: h,
      in: 'header',
      type: 'apiKey'
    })));
  });

  describe('processBody()', () => {
    it('WHEN request with body with JSON is provided THEN sets body parameter', () => {
      const req = { body: { a: 1 } };
      let method = {};
      processors.processBody(req, method);
      const param = method.parameters[0];
      expect(param.in).toBe('body');
      expect(param.name).toBe('body');
      expect(param.required).toBe(true);
      expect(param.schema).not.toBe(undefined);
    });

    it('WHEN request with empty body is provided THEN sets no parameters', () => {
      const req = { body: {} };
      const method = {};
      processors.processBody(req, method);
      expect(method.parameters).toBe(undefined);
    });

    it('WHEN called twice THE should not add element twice', () => {
      const req = { body: { a: 1 } };
      let method = {};
      processors.processBody(req, method);
      processors.processBody(req, method);
      expect(method.parameters.length).toBe(1);
    });
  });

  describe('processQuery()', () => {
    it('WHEN request with empty query is provided THEN sets no parameters', () => {
      const req = { query: {} };
      const method = {};
      processors.processQuery(req, method);
      expect(method.parameters).toBe(undefined);
    });

    it('WHEN request contains query THEN sets only new parameters', () => {
      const req = { query: {a: 1, b: '2', c: [1, 2, 3]} };
      const aExample = 2;
      const method = { parameters: [{ name: 'a', example: aExample }] };
      processors.processQuery(req, method);
      expect(method.parameters[0].example).toBe(aExample);
      expect(method.parameters[1].name).toBe('b');
      expect(method.parameters[1].in).toBe('query');
      expect(method.parameters[1].type).toBe('integer');
      expect(method.parameters[2].type).toBe('array');
      expect(method.parameters[2].collectionFormat).toBe('multi');
    });
  });

  describe('processResponse()', () => {

    it('WHEN ', () => {
      const appJson = 'application/json';
      const write = jasmine.createSpy();
      const end = jasmine.createSpy();
      let res = {
        get: () => `${appJson}; charset=utf-8`,
        statusCode: 200,
        write: write,
        end: end,
        getHeaders: () => {
          return {}; 
        }
      };
      let method = {};
      const json = { a: 1 };
      processors.processResponse(res, method, () => {
        res.write(JSON.stringify(json));
        res.end('');
        expect(write).toHaveBeenCalled();
        expect(end).toHaveBeenCalled();
        expect(method.produces).toEqual([appJson]);
        expect(Object.keys(method.responses)).toEqual(['200']);
        expect(method.responses['200'].schema).not.toBe(undefined);
        expect(method.responses['200'].description).toBe('OK');
      });
    });

  });

});