const { startServer } = require('../server');

async function setup(_config) {
  const server = startServer();
  console.log('\nTest setup: Started the server.\n');

  /** we'll use this in `teardown.js` to close the server */
  global.server = server;
}

module.exports = setup;
