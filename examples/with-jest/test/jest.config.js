// jest.config.js
/**
 * https://jestjs.io/docs/en/configuration
 */

const { defaults } = require("jest-config");

const config = {
	...defaults,
	testEnvironment: "node",
	globalSetup: "./setup.js",
	globalTeardown: "./teardown.js",
};

module.exports = config;
