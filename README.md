# express-oas-generator

Module to generate OpenAPI (Swagger) specificaton json for ExpressJS 4.x REST API application.

## How to use

* Install module `npm i express-oas-generator --save`
* Import in script where you initialize ExpressJS application
```
const express = require('express');
const expressOasGenerator = require('express-oas-generator');
```
* Run initialization of module right after instatiating app
```
let app = express();
expressOasGenerator.init(app, {});
```
Optional: second argument could be used to overwrite values in generated specification.
* Assuming you running your app on port 8000
    * open [http://localhost:8000/api-docs](http://localhost:8000/api-docs) to see Swagger UI for your REST API
    * specification file is available  [http://localhost:8000/api-spec](http://localhost:8000/api-spec) - link prepended to description field
