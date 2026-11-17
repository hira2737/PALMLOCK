/**
 * PALMLOCK — Centralized Error Handling Middleware
 * Ensures sensitive information, stack traces and server internals are never exposed.
 */

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] [${req.method} ${req.url}]`, err.message);

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: messages.join(', ')
    });
  }

  // Mongoose duplicate key error (e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      error: `A record with this ${field} already exists.`
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication credentials.'
    });
  }

  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;

  return res.status(statusCode).json({
    success: false,
    error: err.message || 'An internal server error occurred. Please try again later.'
  });
}

// 404 Route Not Found Handler
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl} — route not found.`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
