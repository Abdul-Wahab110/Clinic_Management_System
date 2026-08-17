const { ValidationError } = require('../utils/errors');

/**
 * Validation Middleware Wrapper
 * @param {Function} validatorFn - Function receiving req.body and returning an array of error messages
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body, req.params, req.query);
    if (errors && errors.length > 0) {
      const message = errors.length === 1 ? errors[0] : errors.join('; ');
      return next(new ValidationError(message, errors));
    }
    next();
  };
}

module.exports = {
  validate
};
