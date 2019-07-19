'use strict';

if (process.platform !== 'win32') {
  module.exports = {
    checkCoverage: true,
    lines: 100,
    statements: 100,
    functions: 100,
    branches: 100
  };
} else {
  module.exports = {};
}
