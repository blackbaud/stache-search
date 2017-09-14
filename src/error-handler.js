function errorHandler(err, config) {
  console.error(err);
  require('./remove-search-spec')(null, config);
  require('./remove-search-json')(null, config);
  throw err;
}

module.exports = errorHandler;
