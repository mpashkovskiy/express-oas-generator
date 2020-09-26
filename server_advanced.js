/* eslint-disable no-console */
// Example of using the module

const express = require('express');
const bodyParser = require('body-parser');
const generator = require('./index.js');
const _ = require('lodash');
const zlib = require('zlib');
require('./test/lib/mongoose_models/student');
const mongoose = require('mongoose');
const modelNames = mongoose.modelNames();

const app = express();
generator.handleResponses(app, {
  predefinedSpec: function(spec) {
    _.set(spec, 'paths["/students/{name}"].get.parameters[0].description', 'description of a parameter');
    return spec;
  },
  specOutputPath: './test_spec.json',
  mongooseModels: modelNames,
  alwaysServeDocs: true
});

app.use(bodyParser.json({}));
let router = express.Router();
router.route('/students/stranger')
  .get(function(req, res, next) {
    //code here
    console.log('calling /students/stranger');
    res.json({message: 'hello stranger'});
    return next();
  });
router.route('/students/:name')
  .get(function(req, res, next) {
    if (res.headersSent) {
      return next();
    }
    console.log('calling /students/:name');
    res.json({message: 'hello ' + req.params.name});
    return next();
  });
router.route('/gzip')
  .get(function(req, res, next) {
    console.log('calling /gzip');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'gzip');
    zlib.gzip(JSON.stringify({message: 'gzip'}), function(error, result) {
      res.status(200).send(result);
      return next();
    });
  });
app.use(router);
app.set('port', 8080);
generator.handleRequests();
app.listen(app.get('port'), function() {
  console.log('Server started. Open http://localhost:8080/api-docs/');
});
