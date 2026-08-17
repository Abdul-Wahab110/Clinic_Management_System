const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/;
const phoneRegex = /^[\d+\-() ]{7,20}$/;

const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

function validateRegister(body) {
  const errors = [];
  if (!body.full_name || body.full_name.trim().length < 2) {
    errors.push('Full name is required and must be at least 2 characters.');
  }
  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required (e.g. name@example.com).');
  }
  if (!body.password || !passwordRegex.test(body.password)) {
    errors.push('Password must be at least 8 characters long, containing uppercase, lowercase, a digit, and a special character.');
  }
  if (!body.phone || !phoneRegex.test(body.phone.trim()) || body.phone.replace(/\D/g, '').length < 7) {
    errors.push('A valid contact phone number is required (e.g. 03212345676 or +923212345676).');
  }
  if (body.gender && !VALID_GENDERS.includes(body.gender.toLowerCase())) {
    errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}.`);
  }
  if (body.blood_group && !VALID_BLOOD_GROUPS.includes(body.blood_group)) {
    errors.push(`Blood group must be one of: ${VALID_BLOOD_GROUPS.join(', ')}.`);
  }
  if (body.date_of_birth) {
    const dobStr = String(body.date_of_birth).trim();
    let dob = new Date(dobStr);
    if (isNaN(dob.getTime()) && /^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(dobStr)) {
      const parts = dobStr.split(/[\/\-\.]/);
      dob = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    if (isNaN(dob.getTime()) || dob > new Date()) {
      errors.push('Date of birth must be a valid date in the past.');
    }
  }
  return errors;
}

function validateLogin(body) {
  const errors = [];
  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }
  if (!body.password || body.password.length === 0) {
    errors.push('Password is required.');
  }
  return errors;
}

function validateChangePassword(body) {
  const errors = [];
  if (!body.current_password) {
    errors.push('Current password is required.');
  }
  if (!body.new_password || !passwordRegex.test(body.new_password)) {
    errors.push('New password must be at least 8 characters long, containing uppercase, lowercase, a digit, and a special character.');
  }
  if (body.current_password === body.new_password) {
    errors.push('New password cannot be the same as your current password.');
  }
  return errors;
}

function validateForgotPassword(body) {
  const errors = [];
  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }
  return errors;
}

function validateResetPassword(body) {
  const errors = [];
  if (!body.token || body.token.trim().length < 10) {
    errors.push('A valid reset token is required.');
  }
  if (!body.new_password || !passwordRegex.test(body.new_password)) {
    errors.push('New password must be at least 8 characters long, containing uppercase, lowercase, a digit, and a special character.');
  }
  return errors;
}

function validateUpdateProfile(body) {
  const errors = [];
  if (!body.full_name || body.full_name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters.');
  }
  if (body.phone && body.phone.trim().length < 7) {
    errors.push('Phone number is invalid.');
  }
  return errors;
}

function validateUserStatus(body) {
  const errors = [];
  const allowed = ['active', 'inactive', 'suspended'];
  if (!body.status || !allowed.includes(body.status)) {
    errors.push(`Status must be one of: ${allowed.join(', ')}`);
  }
  return errors;
}

function validateAdminCreateUser(body) {
  const errors = [];
  if (!body.full_name || body.full_name.trim().length < 2) {
    errors.push('Full name is required.');
  }
  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }
  if (!body.password || !passwordRegex.test(body.password)) {
    errors.push('Password must meet security criteria (min 8 chars, upper, lower, number, special char).');
  }
  if (!body.role_id || isNaN(body.role_id)) {
    errors.push('A valid role ID is required.');
  }
  return errors;
}

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateUserStatus,
  validateAdminCreateUser
};
