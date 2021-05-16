const fs = require('fs');
const path = require('path');

/**
 * @description Ensures directory of supplied file path
 * Reference: https://stackoverflow.com/questions/13542667/create-directory-when-writing-to-file-in-node-js
 */
const ensureDirectoryExistence = filePath => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  return fs.mkdirSync(dirname);
};

module.exports.ensureDirectoryExistence = ensureDirectoryExistence;