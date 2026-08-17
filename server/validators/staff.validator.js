const validStaffTypes = ['doctor', 'nurse', 'receptionist', 'lab_technician', 'pharmacist', 'accountant', 'admin', 'other'];
const validStaffStatuses = ['active', 'on_leave', 'suspended', 'inactive'];

function validateAddStaff(body) {
  const errors = [];
  if (!body.full_name || body.full_name.trim().length === 0) {
    errors.push('Staff full name is required.');
  }
  if (!body.email || !body.email.includes('@')) {
    errors.push('Valid corporate hospital email address is required.');
  }
  if (!body.staff_type || !validStaffTypes.includes(body.staff_type)) {
    errors.push(`Staff type must be one of: ${validStaffTypes.join(', ')}.`);
  }
  if (!body.designation || body.designation.trim().length === 0) {
    errors.push('Staff professional designation / job title is required.');
  }
  if (body.department_id && (isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0)) {
    errors.push('Department ID must be a valid integer.');
  }
  return errors;
}

function validateUpdateStaff(body) {
  const errors = [];
  if (body.full_name && body.full_name.trim().length === 0) {
    errors.push('Staff full name cannot be blank.');
  }
  if (body.email && !body.email.includes('@')) {
    errors.push('Valid corporate email address is required.');
  }
  if (body.staff_type && !validStaffTypes.includes(body.staff_type)) {
    errors.push(`Staff type must be one of: ${validStaffTypes.join(', ')}.`);
  }
  if (body.status && !validStaffStatuses.includes(body.status)) {
    errors.push(`Staff status must be one of: ${validStaffStatuses.join(', ')}.`);
  }
  return errors;
}

function validateUpdateStatus(body) {
  const errors = [];
  if (!body.status || !validStaffStatuses.includes(body.status)) {
    errors.push(`Staff status must be one of: ${validStaffStatuses.join(', ')}.`);
  }
  return errors;
}

function validateAssignDepartment(body) {
  const errors = [];
  if (!body.department_id || isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0) {
    errors.push('Valid department ID is required.');
  }
  return errors;
}

module.exports = {
  validateAddStaff,
  validateUpdateStaff,
  validateUpdateStatus,
  validateAssignDepartment
};
