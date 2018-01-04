# express-oas-generator

[![Build Status](https://travis-ci.org/mpashkovskiy/express-oas-generator.svg?branch=master)](https://travis-ci.org/mpashkovskiy/express-oas-generator)

Module to:
* automatically generate OpenAPI (Swagger) specification for existing ExpressJS 4.x REST API applications;
* provide Swagger UI basing on generated specification.

## How to use

* Install module `npm i express-oas-generator --save`;
* Import in script where you initialize ExpressJS application;
```javascript
const express = require('express');
const expressOasGenerator = require('express-oas-generator');
```
* Run initialization of module right after instantiating app;
```javascript
let app = express();
expressOasGenerator.init(app, {}); // to overwrite generated specification's values use second argument.

```
* **Important!** In order to get description of all parameters and JSON payloads you have to run REST API tests against the application so module can analyze requests/responses
* Assuming you running your app on port 8000
    * open [http://localhost:8000/api-docs](http://localhost:8000/api-docs) to see Swagger UI for your REST API
    * specification file is available  [http://localhost:8000/api-spec](http://localhost:8000/api-spec) - link prepended to description field

## Rationale

Goal of the module is to provide developers with Swagger UI in development environments. Module process every request and response therefore it may slow down your app - is not supposed to be used in production environment.

Assuming you have ExpressJS REST API application and you
* don't want to write documentation manually;
* but want to use Swagger ecosystem:
  * keep REST API endpoint documented;
  * provide others with Swagger UI to your REST API;
  * generate client libraries for it with Swagger code generator.

## How does it work

1. During initialization module iterates through all routes and methods and initializes OpenAPI (Swagger) specification.
2. After an application start module analyze every request/response and fills specification with schemes and examples.
3. Module replace values of password fields with `******`

## Limitations

1. All headers with prefix `X-` treated as a apiKey type headers;
2. Module doesn't recognize enumerations in JSON objects;