/* eslint-disable no-console */
// Example of using the module

const express = require('express');
const bodyParser = require('body-parser');
const generator = require('./index.js');
const _ = require('lodash');
const zlib = require('zlib');
require('./test/lib/mongoose_models/student');
const mongoose = require('mongoose');

const app = express();
generator.handleResponses(app, {
  predefinedSpec: function(spec) {
    _.set(spec, 'paths["/students/{id}"].get.parameters[0].description', 'description of a parameter');
    return spec;
  },
  specOutputPath: './test_spec.json',
  mongooseModels: mongoose.modelNames(),
  tags: ['Students']
});

app.use(bodyParser.json({}));
let router = express.Router();
router.route('/students')
  .get(function(req, res, next) {
    //code here
    console.log('calling /students');
    res.json({message: 'hello students'});
    return next();
  });
router.route('/students/:id')
  .get(function(req, res, next) {
    console.log('calling /students/:id');
    res.json({message: 'hello ' + req.params.id});
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
