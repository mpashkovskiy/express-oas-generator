// Example of using the module

const express = require('express');
const bodyParser = require('body-parser');
const generator = require('./index.js');
const _ = require('lodash');
const zlib = require('zlib');

const app = express();
generator.init(app, function (spec) {
  _.set(spec, 'paths["/foo/{name}"].get.parameters[0].description', 'description of a parameter');
  return spec;
}, './test_spec.json');

app.use(bodyParser.json({}));
let router = express.Router();
router.route('/foo/stranger')
      .get(function (req, res, next) {
        //code here
        console.log('calling /foo/stranger');
        res.json({message: 'hello stranger'});
        return next();
      });
router.route('/foo/:name')
      .get(function (req, res, next) {
        console.log('calling /foo/:name');
        res.json({message: 'hello ' + req.params.name});
        return next();
      });
router.route('/gzip')
      .get(function (req, res, next) {
        console.log('calling /gzip');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Encoding', 'gzip');
        zlib.gzip(JSON.stringify({message: 'gzip'}), function (error, result) {
          res.status(200).send(result);
          return next();
        })
      });
app.use(router);
app.set('port', 8080);
app.listen(app.get('port'), function () {
  console.log('Server started. Open http://localhost:8080/api-docs/');
});
