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
generator.init(app, function(spec) {
  _.set(spec, 'paths["/students/{name}"].get.parameters[0].description', 'description of a parameter');
  return spec;
}, './test_spec.json', 1000, 'api-docs', modelNames, ['students'], ['production']);

app.use(bodyParser.json({}));
let router = express.Router();
router.route('/students/stranger')
  .post(function(req, res, next) {
    //code here
    console.log('calling /students/stranger');
    res.json(req.body);
    return next();
  });
router.route('/students/:name')
  .get(function(req, res, next) {
    if (res.headersSent) {
      return next();
    }
    console.log('calling /students/:name');
    let a = Math.random();
    if (a > 0.5) {
      res.json({message: 'hello ' + req.params.name});
    } else {
      res.json({message: 'hello ' + req.params.name, a: [{b: 1}, {b: 2, c: 'asd'}]});
    }
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
app.listen(app.get('port'), function() {
  console.log('Server started. Open http://localhost:8080/api-docs/');
});
