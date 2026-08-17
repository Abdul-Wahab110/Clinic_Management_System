const { ApiError } = require('../utils/errors');
const { sendError } = require('../utils/response');
const config = require('../config/env');

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Handle custom ApiError instances
  if (err instanceof ApiError) {
    return sendError(res, err.message, err.statusCode, err.errors, err.errorCode);
  }

  // Handle JSON parsing syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return sendError(res, 'Malformed JSON in request payload', 400, [], 'INVALID_JSON');
  }

  // Handle MySQL errors
  if (err.code === 'ER_DUP_ENTRY') {
    return sendError(res, 'A record with these unique details already exists.', 409, [], 'DUPLICATE_ENTRY');
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    return sendError(res, 'Referenced parent record does not exist.', 400, [], 'FOREIGN_KEY_VIOLATION');
  }

  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return sendError(res, 'Cannot delete or update record because other records depend on it.', 409, [], 'RESTRICTED_FOREIGN_KEY');
  }

  // Log unexpected errors
  console.error('[UNHANDLED_SERVER_ERROR]', {
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  const responseMessage = config.nodeEnv === 'production'
    ? 'An unexpected internal server error occurred.'
    : err.message || 'Internal Server Error';

  return sendError(res, responseMessage, 500, [], 'INTERNAL_SERVER_ERROR');
}

/**
 * 404 Route Not Found Middleware for APIs
 */
function notFoundHandler(req, res, next) {
  if (req.originalUrl.startsWith('/api')) {
    return sendError(res, `API route ${req.method} ${req.originalUrl} not found.`, 404, [], 'ROUTE_NOT_FOUND');
  }
  // For non-API routes, let the static or 404 page handler take over
  res.status(404).sendFile(require('path').join(__dirname, '../../public/pages/404.html'));
}

module.exports = {
  errorHandler,
  notFoundHandler
};
