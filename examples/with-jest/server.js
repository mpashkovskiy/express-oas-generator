const express = require('express');
const { handleResponses, handleRequests } = require('express-oas-generator');

/** work-around until we fix https://github.com/mpashkovskiy/express-oas-generator/issues/51 */
const mkdirp = require('mkdirp');
const path = require('path');

/** work-around until we fix https://github.com/mpashkovskiy/express-oas-generator/issues/52 */
const fs = require('fs');

const app = express();

const openAPIFilePath = './path/to/file.json';

/** handle the responses */
if (process.env.NODE_ENV !== 'production') {
  /** work-around until we fix https://github.com/mpashkovskiy/express-oas-generator/issues/51 */
  mkdirp.sync(path.parse(openAPIFilePath).dir);

  /** work-around until we fix https://github.com/mpashkovskiy/express-oas-generator/issues/52 */
  let predefinedSpec;

  try {
    predefinedSpec = JSON.parse(
      fs.readFileSync(openAPIFilePath, { encoding: 'utf-8' })
    );
  } catch (e) {
    //
  }

  /** work-arounds done. Now handle responses - MUST be the FIRST middleware */
  handleResponses(app, {
    specOutputPath: openAPIFilePath,
    writeIntervalMs: 0,
    predefinedSpec: predefinedSpec ? () => predefinedSpec : undefined,
  });
}

/** add any other middleware */

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get('/api/v1/student', (_req, res, next) => {
  try {
    /**
	 * the data here does not matter - we just want to create a simple response
	 * from which express-oas-generator can create documentation
	 */
    const student = {
      id: 1337,
      name: 'Robert\'); DROP TABLE Students;--'
    };
	
    res.json({ student });
	
    /** `next` must be called so that our request handler also gets reached */
    next();
  } catch (e) {
    /** handle the error */

    /** lastly - call `next` with the exception `e` */
    next(e);
  }
});

/** lastly - add the express-oas-generator request handler (MUST be the LAST middleware) */
if (process.env.NODE_ENV !== 'production') {
  handleRequests();
}

/** optionally - export the app if you need it */
module.exports.app = app;

/**
 * create a function for starting the server.
 *
 * Do not call it here - only export it, and call it in a separate file
 * when you need to start it.
 * 
 * In this example, it gets called inside `./start-server.js` script,
 * or in the `./test/setup.js` file once the tests run.
 * 
 */ 
function startServer() {
  const PORT = Number(process.env.PORT) || 5000;

  const server = app.listen(PORT, () => {
    console.log(`~ Server listening on PORT \`${PORT}\` @ NODE_ENV \`${process.env.NODE_ENV}\``);
  });

  return server;
}

module.exports.startServer = startServer;
