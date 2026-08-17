const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateCreateDepartment(body) {
  const errors = [];

  if (!body.name || body.name.trim().length < 2) {
    errors.push('Department name is required and must be at least 2 characters.');
  }

  if (!body.code || body.code.trim().length < 2 || body.code.trim().length > 20) {
    errors.push('Department code is required (e.g. CARD, NEUR) between 2 and 20 characters.');
  }

  if (body.email && !emailRegex.test(body.email.trim())) {
    errors.push('A valid department email address is required.');
  }

  if (body.consultation_base_fee !== undefined && (isNaN(body.consultation_base_fee) || parseFloat(body.consultation_base_fee) < 0)) {
    errors.push('Base consultation fee must be a valid positive number.');
  }

  if (body.head_doctor_id !== undefined && body.head_doctor_id !== null && body.head_doctor_id !== '' && (isNaN(body.head_doctor_id) || parseInt(body.head_doctor_id, 10) <= 0)) {
    errors.push('Head doctor ID must be a valid positive integer.');
  }

  return errors;
}

function validateUpdateDepartment(body) {
  const errors = [];

  if (body.name !== undefined && body.name.trim().length < 2) {
    errors.push('Department name must be at least 2 characters.');
  }

  if (body.code !== undefined && (body.code.trim().length < 2 || body.code.trim().length > 20)) {
    errors.push('Department code must be between 2 and 20 characters.');
  }

  if (body.email !== undefined && body.email !== '' && !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (body.consultation_base_fee !== undefined && (isNaN(body.consultation_base_fee) || parseFloat(body.consultation_base_fee) < 0)) {
    errors.push('Base consultation fee must be a valid positive number.');
  }

  return errors;
}

function validateDepartmentStatus(body) {
  const errors = [];
  if (body.is_active === undefined || typeof body.is_active !== 'boolean' && body.is_active !== 0 && body.is_active !== 1) {
    errors.push('Active status boolean (is_active: true/false) is required.');
  }
  return errors;
}

function validateAssignDoctor(body) {
  const errors = [];
  if (!body.doctor_id || isNaN(body.doctor_id) || parseInt(body.doctor_id, 10) <= 0) {
    errors.push('A valid doctor ID is required for department assignment.');
  }
  return errors;
}

module.exports = {
  validateCreateDepartment,
  validateUpdateDepartment,
  validateDepartmentStatus,
  validateAssignDoctor
};
