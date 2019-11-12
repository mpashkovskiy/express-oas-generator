# express-oas-generator

[![npm package](https://nodei.co/npm/express-oas-generator.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/express-oas-generator/)

[![Build Status](https://travis-ci.org/mpashkovskiy/express-oas-generator.svg?branch=master)](https://travis-ci.org/mpashkovskiy/express-oas-generator) [![Coverage Status](https://coveralls.io/repos/github/mpashkovskiy/express-oas-generator/badge.svg)](https://coveralls.io/github/mpashkovskiy/express-oas-generator) [![Known Vulnerabilities](https://snyk.io/test/github/mpashkovskiy/express-oas-generator/badge.svg?targetFile=package.json)](https://snyk.io/test/github/mpashkovskiy/express-oas-generator?targetFile=package.json)

Module to:
* automatically generate OpenAPI (Swagger) specification for existing ExpressJS 4.x REST API applications;
* provide Swagger UI basing on generated specification.


## How to use

> Note - make sure to also read the [Advanced usage (recommended)](#advanced-usage-recommended) section after this!

* Install module `npm i express-oas-generator --save`;
* Import it in a script where you initialize ExpressJS application (see [server.js](server.js) for usage example);
```javascript
const express = require('express');
const expressOasGenerator = require('express-oas-generator');
```
* Run initialization of module right after instantiating app;
```javascript
let app = express();
expressOasGenerator.init(app, {}); // to overwrite generated specification's values use second argument.

```
* **Important!** In order to get description of all parameters and JSON payloads you have to start using your REST API or run REST API tests against it so module can analyze requests/responses
* Assuming you running your app on port 8000
    * open [http://localhost:8000/api-docs](http://localhost:8000/api-docs) to see Swagger UI for your REST API
    * specification file is available  [http://localhost:8000/api-spec](http://localhost:8000/api-spec) - link is prepended to description field
    
Second argument of `expressOasGenerator.init(app, {})` could be either an object or a function. In case of the object generated spec will be merged with the object. In case of function it will be used to apply changes for generated spec. Example of function usage:
```javascript
generator.init(app, function(spec) {
    _.set(spec, 'info.title', 'New Title');
    _.set(spec, 'paths[\'/path\'].get.parameters[0].example', 2);
    return spec;
});

```

To write specification into a file use third and forth (optional) arguments:
```javascript
expressOasGenerator.init(
  app,
  function(spec) { return spec; },
  'path/to/a/file/filename.json',
  60 * 1000
)
```
where:
* 'path/to/a/file/filename.json' - path to a file and file name
* 60 * 1000 - write interval in milliseconds (optional parameter, by default interval is equal to 10 seconds)

To change the Swagger UI path for your REST API use fifth (optional) argument:
```javascript
expressOasGenerator.init(
  app,
  function(spec) { return spec; },
  'path/to/a/file/filename.json',
  60 * 1000,
  'custom-docs-path'
)
```
where:
* 'path/to/a/file/filename.json' - path to a file and file name
* 60 * 1000 - write interval in milliseconds (optional parameter, by default interval is equal to 10 seconds)
* 'custom-docs-path' - Swagger UI path for your REST API (default: api-docs)

## Advanced usage (recommended)

Instead of using a single `init` handler, we'll use 2 separate ones - one for **responses**, and one for **requests**.

```diff
let app = express();

-expressOasGenerator.init(app, {});
+expressOasGenerator.handleResponses(app, {});

/** do other stuff with `app` */

/** place this as the last middleware */
+expressOasGenerator.handleRequests(app);

app.listen(PORT);
```

mind the order of the middleware handlers - first we apply the one for **responses**, then we apply the one for **requests**,
which might seem counter-intuitive since requests come before responses, but this is how we need to do it.

Don't worry - we'll throw a loud error if you messed this up so that you can correct yourself quickly! 💥

### Why do we need to do this?

In order to generate documentation, we need to analyze both **responses** and **requests**.

The tricky thing is - one handler must be placed as the very first middleware of the express app,
and the other must be the very last.

In the `expressOasGenerator.init()` method, we assume you that place it straight after initializing the express app.
We create a `setTimeout` of `1000` miliseconds, and then we place the other handler,
to make sure it's the last middleware.

The basic approach is error-prone

* if you have heavy initialization logic

if it takes longer than a second, then the request handler will be placed, and it would not be the last middleware of the app.

* if you want to start using the API as soon as possible

in this case, requests would not be handled until the `1000` milisecond `setTimeout` passes and applies the request middleware.

This could occur, for example, if you start your express server and then run the API tests immidiately - that wouldn't work. You'd have to start your server and then make your tests wait a second before the request middleware is applied.

## (Optional) Additions to your package.json

If your service is running not at the root of the server add full base path URL to package.json

```json 
{
  "baseUrlPath" : "/tokens"
}
```

Here is a sample
```json 
{
  "name": "cwt-sts-svc",
  "version": "1.1.48",
  "description": "JWT generation service",
  "keywords": [],
  "author": "",
  "main": "lib",
  "baseUrlPath" : "/tokens",
  "bin": {
    "cwt-sts-svc": "bin/server"
  }
```

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
