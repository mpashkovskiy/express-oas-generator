/* eslint-disable no-console */
// Example of using the module

const express = require("express");
const bodyParser = require("body-parser");
const generator = require("./index.js");
const _ = require("lodash");
require("./test/lib/mongoose_models/student");
const mongoose = require("mongoose");
const modelNames = mongoose.modelNames();
const { SPEC_OUTPUT_FILE_BEHAVIOR } = generator;

const app = express();
generator.init(
  app,
  function (spec) {
    return spec;
  },
  "./test_spec.json",
  1000,
  "api-docs",
  modelNames,
  ["students"],
  ["production"],
  SPEC_OUTPUT_FILE_BEHAVIOR.PRESERVE
);

app.use(bodyParser.json({}));
let router = express.Router();
router.route("/api/1.0/students/:name").get(function (req, res, next) {
  if (res.headersSent) {
    return next();
  }
  console.log("calling /students/:name");
  let a = Math.random();
  if (a > 0.5) {
    res.json({ message: "hello " + req.params.name });
  } else {
    res.json({
      message: "hello " + req.params.name,
      a: [{ b: 1 }, { b: 2, c: "asd" }],
    });
  }
  return next();
});
app.use(router);
app.set("port", 8080);
app.listen(app.get("port"), function () {
  console.log("Server started. Open http://localhost:8080/api-docs/");
});
