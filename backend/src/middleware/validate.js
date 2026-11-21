const { validationResult } = require('express-validator');

/**
 * Middleware factory that runs express-validator chains and
 * returns 422 with structured errors if validation fails.
 * @param {Array} validations - Array of express-validator validation chains
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);

    if (errors.isEmpty()) {
      return next();
    }

    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    return res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed.',
        details: formattedErrors,
      },
      message: 'Validation failed.',
      errors: formattedErrors,
    });
  };
};

module.exports = { validate };
