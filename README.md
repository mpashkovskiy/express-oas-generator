# express-oas-generator

[![npm package](https://nodei.co/npm/express-oas-generator.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/express-oas-generator/)

[![Build Status](https://travis-ci.org/mpashkovskiy/express-oas-generator.svg?branch=master)](https://travis-ci.org/mpashkovskiy/express-oas-generator) [![Coverage Status](https://coveralls.io/repos/github/mpashkovskiy/express-oas-generator/badge.svg)](https://coveralls.io/github/mpashkovskiy/express-oas-generator) [![Known Vulnerabilities](https://snyk.io/test/github/mpashkovskiy/express-oas-generator/badge.svg?targetFile=package.json)](https://snyk.io/test/github/mpashkovskiy/express-oas-generator?targetFile=package.json)

Module to:
* automatically generate OpenAPI (Swagger) specification for existing ExpressJS 4.x REST API applications;
* provide Swagger UI basing on generated specification.

#### WARNINING!
Again: goal of the module is to provide baseline specification which should be reviewed and modified before exposing to REST API clients.
Module should be used in test environment only because it can disclose sensitive information if it is running in production. See [How does it work?](#how-does-it-work) and [comment about usage](https://github.com/mpashkovskiy/express-oas-generator/issues/36#issuecomment-553040533) for more info.

## Examples

* [server_basic.js](server_basic.js)
* [server_advanced.js](server_advanced.js)
* [./examples](./examples):
    * [./examples/with-jest](./examples/with-jest)

## How to use

> Note - make sure to also read the [Advanced usage (recommended)](#advanced-usage-recommended) section after this!

* Install module `npm i express-oas-generator --save`;
* Import it in a script where you initialize ExpressJS application (see [server_basic.js](server_basic.js) for usage example);
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
  60 * 1000,
  ['User','Student']
)
```
where:
* 'path/to/a/file/filename.json' - path to a file and file name
* 60 * 1000 - write interval in milliseconds (optional parameter, by default interval is equal to 10 seconds)
* ['User','Student'] - Mongoose models to be included as definitions. To get all just do mongoose.modelNames()

To change the Swagger UI path for your REST API use fifth (optional) argument:
```javascript
expressOasGenerator.init(
  app,
  function(spec) { return spec; },
  'path/to/a/file/filename.json',
  60 * 1000,
  'custom-docs-path',
  ['User','Student']
)
```
where:
* 'path/to/a/file/filename.json' - path to a file and file name
* 60 * 1000 - write interval in milliseconds (optional parameter, by default interval is equal to 10 seconds)
* 'custom-docs-path' - Swagger UI path for your REST API (default: api-docs)
* ['User','Student'] - Mongoose models to be included as definitions. To get all just do mongoose.modelNames()

## Advanced usage (recommended)

Instead of using a single `init` handler, we'll use 2 separate ones - one for **responses**, and one for **requests**.

```javascript
let app = express();
/** place handleResponses as the very first middleware */
expressOasGenerator.handleResponses(app, {});

/** initialize your `app` and routes */

/** place handleRequests as the very last middleware */
expressOasGenerator.handleRequests();
app.listen(PORT);
```

mind the order of the middleware handlers - first we apply the one for **responses**, then we apply the one for **requests**,
which might seem counter-intuitive since requests come before responses, but this is how we need to do it because:

* to intercept responses `response.write()/end()` methods should be wrapped before any route or middleware call it
* to intercept requests in right format they have to be read after parsing middlewares like `body-parser`

Don't worry - we'll throw a loud error if you messed this up so that you can correct yourself quickly! 💥

See [server_advanced.js](server_advanced.js) for usage example.

### Why do we need to do this?

In order to generate documentation, we need to analyze both **responses** and **requests**.

The tricky thing is - one handler must be placed as the very first middleware of the express app,
and the other must be the very last. It is needed to intercept all the data (headers and payload) coming in and out out the app.

In the `expressOasGenerator.init()` method, we assume that you place it straight after initializing the express app.
Inside we place response intercept middleware and then we call `setTimeout` with `1000` miliseconds to make sure we place our request intercept middleware as the very last one.

The basic approach is error-prone because:

* if you have heavy initialization logic it can take longer than a second, then the request handler will be placed, and it would not be the last middleware of the app.
* if you want to start using the API as soon as possible requests would not be handled until the `1000` milisecond `setTimeout` passes and applies the request middleware.

This could occur, for example, if you start your express server and then run the API tests immidiately - that wouldn't work.
You'd have to start your server and then make your tests wait a second before the request middleware is applied.

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

## How does it work?

1. During initialization module iterates through all routes and methods and initializes OpenAPI (Swagger) specification.
2. After an application start module analyze every request/response and fills specification with schemes and examples.
3. Module replace values of password fields with `******`

## Limitations

1. All headers with prefix `X-` treated as a apiKey type headers;
2. Module doesn't recognize enumerations in JSON objects;

## Troubleshooting

* Parameters and response body not documented!
  
  Express-oas-generator (EOG) adds parameters handler as a very last middleware. If any middleware or path in router breaks the chain and doesn't pass execution to next middleware/router then very last EOG middleware won't be called. So call next() or next(err) as the very last line in your handler.
  Some docs:
  * calling next() https://expressjs.com/en/guide/writing-middleware.html
  * handling errors with next() https://expressjs.com/en/guide/error-handling.html
  
  For more info please read the entire [issue report](https://github.com/mpashkovskiy/express-oas-generator/issues/24)

## Contributors

[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/0)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/0)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/1)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/1)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/2)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/2)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/3)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/3)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/4)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/4)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/5)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/5)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/6)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/6)[![](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/images/7)](https://sourcerer.io/fame/mpashkovskiy/mpashkovskiy/express-oas-generator/links/7)
