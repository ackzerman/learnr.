/**
 * Global error-handling middleware.
 * Must be registered LAST in server.js (after all routes).
 *
 * Catches errors passed via next(err) from any route or middleware.
 */
const errorHandler = (err, req, res, next) => {
  // ── Mongoose CastError (e.g. invalid ObjectId in URL params) ──────────────
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // ── Mongoose ValidationError (schema validation failures) ─────────────────
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
    });
  }

  // ── Mongoose duplicate key error (code 11000) ─────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `Duplicate value for ${field}. This ${field} already exists.`,
    });
  }

  // ── Application errors (AppError or generic) ──────────────────────────────
  const statusCode = err.statusCode || 500;

  console.error(`[Error] ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    // Only expose the stack trace in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

module.exports = errorHandler;

