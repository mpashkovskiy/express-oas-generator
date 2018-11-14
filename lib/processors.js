const generateSchema = require('generate-schema');
const utils = require('./utils');

module.exports.processPath = (req, method, pathKey) => {
  if (pathKey.indexOf('{') === -1) {
    return;
  }

  const pathRegexp = pathKey.replace(/{([^/]+)}/g, '(.+)?');
  const matches = req.url.match(pathRegexp);

  if (!matches) {
    return;
  }

  let i = 1;
  method.parameters.forEach(p => {
    if (p.in === 'path') {
      p.type = utils.getType(matches[i]);
      p.example = p.type === 'string' ? matches[i] : Number(matches[i]);
      i += 1;
    }
  });
};

function updateSecurity(method, headerName) {
  method.security = method.security || [];
  if (method.security.map(s => Object.keys(s)[0]).indexOf(headerName) === -1) {
    const obj = {};
    obj[headerName] = [];
    method.security.push(obj);
  }
}

function updateSecurityDefinitions(spec, headerName) {
  spec.securityDefinitions = spec.securityDefinitions || {};
  spec.securityDefinitions[headerName] = {
    name: headerName,
    in: 'header',
    type: 'apiKey',
  };
}

module.exports.processHeaders = (req, method, spec) => {
  Object
    .keys(req.headers)
    .filter(h => h.toLowerCase() === 'authorization' || h.toLowerCase().startsWith('x-'))
    .forEach(h => {
      if (h.toLowerCase() === 'authorization') {
        method.responses = method.responses || {};
        method.responses[401] = { description: 'Unauthorized' };
      }
      updateSecurity(method, h);
      updateSecurityDefinitions(spec, h);
    });
};

module.exports.processBody = (req, method) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return;
  }

  method.parameters = method.parameters || [];
  if (method.parameters.filter(p => p.in === 'body').length !== 0) {
    return;
  }

  method.parameters.push({
    in: 'body',
    name: 'body',
    required: true,
    schema: utils.getSchema(req.body),
  });
};

module.exports.processQuery = (req, method) => {
  const params = req.query;
  if (!params || Object.keys(params).length === 0) {
    return;
  }

  const props = generateSchema.json(params).properties;
  for (const p in props) {
    if (method.parameters.filter(param => param.name === p).length !== 0) {
      continue;
    }

    const param = props[p];
    param.name = p;
    param.in = 'query';
    param.example = params[p];
    if (param.type === 'array') {
      param.collectionFormat = 'multi';
    } else if (param.type === 'string') {
      param.type = utils.getType(params[p]);
    }
    method.parameters.push(param);
  }
};

function updateProduces(res, method) {
  let contentType = res.get('content-type');
  if (!contentType) {
    return;
  }

  contentType = contentType.split(';')[0];
  method.produces = method.produces || [];
  if (method.produces.indexOf(contentType) === -1) {
    method.produces.push(contentType);
  }
}

function updateResponses(res, method, chunks) {
  method.responses = method.responses || {};
  method.responses[res.statusCode] = {};
  const contentType = res.get('content-type');
  if (!contentType || contentType.indexOf('json') === -1 && contentType.indexOf('text') === -1) {
    return;
  }

  let body = '';
  let schema;
  try {
    body = Buffer.concat(chunks).toString('utf8');
    body = JSON.parse(body);
    schema = utils.getSchema(body);
  } catch (ex) {
    const type = utils.getType(body);
    schema = {
      type: type,
      example: type === 'string' ? body : Number(body)
    };
  }
  method.responses[res.statusCode].schema = schema;
}

function appendChunkIfNeeded(res, method, chunks, chunk) {
  if (method.responses && method.responses[res.statusCode]) {
    return;
  }

  if (!chunk) {
    return;
  }

  chunks.push(new Buffer(chunk));
}

function isCompressed(res) {
  return ['gzip', 'compress', 'deflate'].indexOf(res.headers()['content-encoding']) !== -1;
}

module.exports.processResponse = (res, method) => {
  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks = [];

  res.write = function(chunk) {
    try {
      if (!isCompressed(res)) {
        appendChunkIfNeeded(res, method, chunks, chunk);
      }
    } finally {
      oldWrite.apply(res, arguments);
    }
  };

  res.end = function(chunk) {
    try {
      if (!isCompressed(res)) {
        appendChunkIfNeeded(res, method, chunks, chunk);
        updateProduces(res, method);
        if (!method.responses || !method.responses[res.statusCode]) {
          updateResponses(res, method, chunks);
        }
      }
    } finally {
      oldEnd.apply(res, arguments);
    }
  };
};
