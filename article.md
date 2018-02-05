# Proposal: Incorporating Open API specificatoion into micro-services development process

## Open API (Swagger) Specification

Specification for machine-readable interface files for describing, producing, consuming, and visualizing RESTful Web services.
Specification is used also by AWS API Gateway.

Example:

```json
{
  "swagger": "2.0",
  "paths": {
    "/api/v1/login": {
      "post": {
        "consumes": [ "application/json" ],
        "produces": [ "application/json" ],
        "parameters": [
          {
            "in": "body",
            "name": "body",
            "required": true,
            "schema": { ... }
          }
        ],
        "responses": {
          "200": {
            "schema": { ... }
          }
        },
        "security": [
          { "authorization": [] },
          { "x-api-key": [] }
        ]
      }
    }
  }
}
```

Goals:
* Keep docs always up-to-date and close to the code
* Improve current REST API design review process
* Provide interface to explore REST API

## Initial generation and improving the spec

Initial generation:
1. Deploy
2. Run TA or/and use UI
3. Fetch JSON from http://host/api-spec
4. Store to the repo
5. Add as a patch to expressOasGenerator

```js
expressOasGenerator.init(app, require('api-spec.json'));
```

Rule for improving the spec: "Whenever changing spec (adding new features) make endpoint a bit better: add a description, tag or something else".

(Demo)

Questions:
* Grouping endpoints
* Cleaning up the data (requests/responses, internal endpoints). Generator replaces passwords with '******', what other sensitive information do we have?

Problems:
* If no initial spec is provided redeploy of micro-service will wipe the spec
* 2 nodes behind load balancer thus generated spec could be not complete
* Possible slow down of the micro-service. Middleware process every request and keep swagger spec in memory

## Changing API (new feature development)

1. Change spec
2. Create PR
3. Merge PR

Problem: Spec contains unimplemented feature:
Solution: Would be good PR will be merged together with implementation

## Publishing API docs

1. fetch spec from repo
2. apply patch
3. generate HTML code and publish