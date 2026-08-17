class ApiError extends Error {
  constructor(statusCode, message, errors = [], errorCode = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends ApiError {
  constructor(message = 'Bad Request', errors = []) {
    super(400, message, errors, 'BAD_REQUEST');
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required. Please login.') {
    super(401, message, [], 'UNAUTHORIZED');
  }
}

class ForbiddenError extends ApiError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, message, [], 'FORBIDDEN');
  }
}

class NotFoundError extends ApiError {
  constructor(message = 'Requested resource not found.') {
    super(404, message, [], 'NOT_FOUND');
  }
}

class ConflictError extends ApiError {
  constructor(message = 'Resource already exists or conflict occurred.') {
    super(409, message, [], 'CONFLICT');
  }
}

class ValidationError extends ApiError {
  constructor(message = 'Validation failed', errors = []) {
    super(422, message, errors, 'VALIDATION_ERROR');
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError
};
