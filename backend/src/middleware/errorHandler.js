const config = require('../config');

function defaultCodeForStatus(status) {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    default: return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Global error handling middleware.
 * Catches all errors passed via next(error) and returns a consistent JSON response
 * matching the schema { error: { code, message } }.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Known operational errors
  if (err.isOperational) {
    const code = err.code || defaultCodeForStatus(err.statusCode || 400);
    return res.status(err.statusCode || 400).json({
      success: false,
      error: {
        code,
        message: err.message,
      },
      message: err.message,
    });
  }

  // Knex / PostgreSQL / SQLite unique constraint violations
  const isUniqueViolation =
    err.code === '23505' ||
    err.code === 'SQLITE_CONSTRAINT' ||
    err.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    (err.message && err.message.toLowerCase().includes('unique constraint'));

  if (isUniqueViolation) {
    const isSlotConstraint =
      (err.constraint && (err.constraint.includes('slot') || err.constraint.includes('idx_appointments_slot_active'))) ||
      (err.detail && err.detail.includes('slot_id')) ||
      (err.message && (
        err.message.includes('slot_id') ||
        err.message.includes('idx_appointments_slot_active')
      ));

    const code = isSlotConstraint ? 'SLOT_TAKEN' : 'CONFLICT';
    const message = isSlotConstraint
      ? 'This slot is already booked. Please choose another.'
      : 'A record with this information already exists.';

    return res.status(409).json({
      success: false,
      error: {
        code,
        message,
      },
      message,
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Referenced record does not exist.',
      },
      message: 'Referenced record does not exist.',
    });
  }

  // Default server error
  const statusCode = err.statusCode || 500;
  const message =
    config.nodeEnv === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message,
    },
    message,
    ...(config.nodeEnv !== 'production' && { stack: err.stack }),
  });
};

/**
 * Custom operational error class with structured error codes.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || defaultCodeForStatus(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, AppError };
