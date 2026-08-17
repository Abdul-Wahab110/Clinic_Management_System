/**
 * Standard API Response Formatter
 */
function sendSuccess(res, data = null, message = 'Success', statusCode = 200, meta = null) {
  const response = {
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString()
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
}

function sendCreated(res, data = null, message = 'Resource created successfully', meta = null) {
  return sendSuccess(res, data, message, 201, meta);
}

function sendError(res, message = 'An error occurred', statusCode = 500, errors = [], errorCode = 'INTERNAL_ERROR') {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    errorCode,
    message,
    errors: Array.isArray(errors) ? errors : [errors],
    timestamp: new Date().toISOString()
  });
}

function sendPaginated(res, items, total, page, limit, message = 'Items retrieved successfully') {
  const totalPages = Math.ceil(total / limit);
  return sendSuccess(res, items, message, 200, {
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: parseInt(total, 10),
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
  sendPaginated
};
