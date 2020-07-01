/**
 * @fileOverview utils
 * @module lib/utils
 */

const generateSchema = require('generate-schema');

/**
 *
 * @param o
 */
module.exports.sortObject = o => {
  const sorted = {};
  let key;
  const a = [];
  for (key in o) {
    if (o.hasOwnProperty(key)) {
      a.push(key);
    }
  }
  a.sort();
  for (key = 0; key < a.length; key += 1) {
    sorted[a[key]] = o[a[key]];
  }
  return sorted;
};

/**
 *
 * @param obj
 * @returns {string}
 */
module.exports.getType = obj => {
  if ([true, false, 'true', 'false'].indexOf(obj) !== -1) {
    return 'boolean';
  }

  if (isNaN(obj)) {
    return {}.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }

  if (`${obj}`.indexOf('.') !== -1) {
    return 'float';
  }

  return 'integer';
};

/**
 *
 * @param schema
 * @param vals
 */
const fillExamples = (schema, vals) => {
  for (const prop in schema.properties) {
    if (schema.properties[prop].type === 'object') {
      fillExamples(schema.properties[prop], vals[prop]);
    } else if (schema.properties[prop].type === 'array') {
      schema.properties[prop].example = [vals[prop][0]];
    } else {
      schema.properties[prop].example = prop === 'password' ? '******' : vals[prop];
    }
  }
};

/**
 *
 * @param json
 * @returns {{$schema}}
 */
module.exports.getSchema = json => {
  const schema = generateSchema.json(json);
  delete schema.$schema;
  fillExamples(schema, json);
  return schema;
};

/**
 *
 * @param responseCode
 * @returns {string}
 */
module.exports.getResponseDescription = responseCode => {
  const responseDescriptionMapping = {
    '100': 'Continue',
    '101': 'Switching Protocols',
    '102': 'Processing',
    '200': 'OK',
    '201': 'Created',
    '202': 'Accepted',
    '203': 'Non-authoritative Information',
    '204': 'No Content',
    '205': 'Reset Content',
    '206': 'Partial Content',
    '207': 'Multi-Status',
    '208': 'Already Reported',
    '226': 'IM Used',
    '300': 'Multiple Choices',
    '301': 'Moved Permanently',
    '302': 'Found',
    '303': 'See Other',
    '304': 'Not Modified',
    '305': 'Use Proxy',
    '307': 'Temporary Redirect',
    '308': 'Permanent Redirect',
    '400': 'Bad Request',
    '401': 'Unauthorized',
    '402': 'Payment Required',
    '403': 'Forbidden',
    '404': 'Not Found',
    '405': 'Method Not Allowed',
    '406': 'Not Acceptable',
    '407': 'Proxy Authentication Required',
    '408': 'Request Timeout',
    '409': 'Conflict',
    '410': 'Gone',
    '411': 'Length Required',
    '412': 'Precondition Failed',
    '413': 'Payload Too Large',
    '414': 'Request-URI Too Long',
    '415': 'Unsupported Media Type',
    '416': 'Requested Range Not Satisfiable',
    '417': 'Expectation Failed',
    '418': 'I\'m a teapot',
    '421': 'Misdirected Request',
    '422': 'Unprocessable Entity',
    '423': 'Locked',
    '424': 'Failed Dependency',
    '426': 'Upgrade Required',
    '428': 'Precondition Required',
    '429': 'Too Many Requests',
    '431': 'Request Header Fields Too Large',
    '444': 'Connection Closed Without Response',
    '451': 'Unavailable For Legal Reasons',
    '499': 'Client Closed Request',
    '500': 'Internal Server Error',
    '501': 'Not Implemented',
    '502': 'Bad Gateway',
    '503': 'Service Unavailable',
    '504': 'Gateway Timeout',
    '505': 'HTTP Version Not Supported',
    '506': 'Variant Also Negotiates',
    '507': 'Insufficient Storage',
    '508': 'Loop Detected',
    '510': 'Not Extended',
    '511': 'Network Authentication Required',
    '599': 'Network Connect Timeout Error'
  };
  return responseDescriptionMapping[responseCode];
};

