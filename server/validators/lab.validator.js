const validStatuses = ['ordered', 'sample_collected', 'processing', 'completed', 'verified', 'cancelled'];
const validPriorities = ['routine', 'urgent', 'stat'];
const validFlags = ['normal', 'high', 'low', 'critical', 'abnormal'];

function validateCreateLabOrder(body) {
  const errors = [];

  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('A valid patient ID is required.');
  }

  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}.`);
  }

  if (!body.test_ids && !body.items) {
    errors.push('At least one laboratory test must be selected for the order.');
  } else {
    const list = body.test_ids || body.items;
    if (!Array.isArray(list) || list.length === 0) {
      errors.push('At least one laboratory test must be selected for the order.');
    }
  }

  return errors;
}

function validateSaveLabResults(body) {
  const errors = [];

  if (!body.results || !Array.isArray(body.results) || body.results.length === 0) {
    errors.push('At least one parameter result must be provided.');
  } else {
    body.results.forEach((r, idx) => {
      if (!r.parameter_name || r.parameter_name.trim().length === 0) {
        errors.push(`Result #${idx + 1}: Parameter name is required.`);
      }
      if (r.result_value === undefined || r.result_value === null || r.result_value.toString().trim().length === 0) {
        errors.push(`Result #${idx + 1}: Result value is required.`);
      }
      if (r.flag && !validFlags.includes(r.flag)) {
        errors.push(`Result #${idx + 1}: Flag must be one of: ${validFlags.join(', ')}.`);
      }
    });
  }

  return errors;
}

function validateUpdateOrderStatus(body) {
  const errors = [];

  if (!body.status || !validStatuses.includes(body.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  return errors;
}

module.exports = {
  validateCreateLabOrder,
  validateSaveLabResults,
  validateUpdateOrderStatus
};
