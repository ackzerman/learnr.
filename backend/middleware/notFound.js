/**
 * Catches any request that doesn't match a defined route
 * and forwards a 404 error to the global error handler.
 */
const notFound = (req, res, next) => {
  const error = new Error("Route not found.");
  error.statusCode = 404;
  next(error);
};

module.exports = notFound;
