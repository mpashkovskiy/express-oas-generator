function teardown(_config) {
  global.server.close(() => {
    console.log('\nTest teardown: Stopped the server.\n');
  });
}

module.exports = teardown;
