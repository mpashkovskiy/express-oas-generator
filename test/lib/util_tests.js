'use strict';

const utils = require('../../lib/utils.js');

describe('utils.js', () => {

  it('WHEN sortObject method called THEN resulting object sorted by keys', () => {
    const obj = {b: 1, a: 2};
    const sortedObject = utils.sortObject(obj);
    expect(Object.keys(sortedObject)).toEqual(Object.keys(obj).sort());
  });

  it('WHEN getType method called THEN it returns proper type', () => {
    expect(utils.getType('a')).toBe('string');
    expect(utils.getType('true')).toBe('boolean');
    expect(utils.getType(true)).toBe('boolean');
    expect(utils.getType('1a')).toBe('string');
    expect(utils.getType('1')).toBe('integer');
    expect(utils.getType(1)).toBe('integer');
    expect(utils.getType(1.5)).toBe('float');
    expect(utils.getType('1.5')).toBe('float');
    expect(utils.getType([1, 2])).toBe('array');
    expect(utils.getType({a: 1})).toBe('object');
  });

  it('WHEN getSchema method called THEN it returns schema with examples and replace password examples with ******', () => {
    const obj = {
      a: 2,
      b: '1',
      password: '123456',
      inner0: {
        inner1: {
          password: '122'
        },
        a: [1, 2]
      }
    };
    const schema = utils.getSchema(obj);
    expect(schema.properties.a.type).toBe('number');
    expect(schema.properties.a.example).toBe(obj.a);
    expect(schema.properties.b.type).toBe('string');
    expect(schema.properties.password.example).toBe('******');
    expect(schema.properties.inner0.properties.inner1.properties.password.example).toBe('******');
    expect(schema.properties.inner0.properties.a.example).toEqual([1]);
  });

});
