const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const validStatuses = ['active', 'inactive', 'on_leave', 'suspended'];

function validateCreateDoctor(body) {
  const errors = [];

  if (!body.first_name || body.first_name.trim().length < 2) {
    errors.push('First name is required and must be at least 2 characters.');
  }

  if (!body.last_name || body.last_name.trim().length < 2) {
    errors.push('Last name is required and must be at least 2 characters.');
  }

  if (!body.email || !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!body.phone || body.phone.trim().length < 7) {
    errors.push('A valid contact phone number is required.');
  }

  if (!body.department_id || isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0) {
    errors.push('A valid clinical department assignment is required.');
  }

  if (!body.specialization || body.specialization.trim().length < 2) {
    errors.push('Doctor specialization title is required.');
  }

  if (!body.qualification || body.qualification.trim().length < 2) {
    errors.push('Medical qualification credentials are required.');
  }

  if (body.consultation_fee !== undefined && (isNaN(body.consultation_fee) || parseFloat(body.consultation_fee) < 0)) {
    errors.push('Consultation fee must be a valid positive number.');
  }

  if (body.experience_years !== undefined && (isNaN(body.experience_years) || parseInt(body.experience_years, 10) < 0)) {
    errors.push('Years of experience must be a non-negative integer.');
  }

  if (body.status && !validStatuses.includes(body.status)) {
    errors.push('Doctor status must be one of: active, inactive, on_leave, suspended.');
  }

  if (body.schedules && Array.isArray(body.schedules)) {
    body.schedules.forEach((s, idx) => {
      if (!s.day_of_week || !validDays.includes(s.day_of_week)) {
        errors.push(`Schedule #${idx + 1}: Valid day of week is required.`);
      }
      if (!s.start_time || !timeRegex.test(s.start_time)) {
        errors.push(`Schedule #${idx + 1}: Start time must be in HH:MM format.`);
      }
      if (!s.end_time || !timeRegex.test(s.end_time)) {
        errors.push(`Schedule #${idx + 1}: End time must be in HH:MM format.`);
      }
    });
  }

  return errors;
}

function validateUpdateDoctor(body) {
  const errors = [];

  if (body.first_name !== undefined && body.first_name.trim().length < 2) {
    errors.push('First name must be at least 2 characters.');
  }

  if (body.last_name !== undefined && body.last_name.trim().length < 2) {
    errors.push('Last name must be at least 2 characters.');
  }

  if (body.email !== undefined && !emailRegex.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (body.phone !== undefined && body.phone.trim().length < 7) {
    errors.push('A valid phone number is required.');
  }

  if (body.department_id !== undefined && (isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0)) {
    errors.push('A valid clinical department assignment is required.');
  }

  if (body.specialization !== undefined && body.specialization.trim().length < 2) {
    errors.push('Specialization title must be at least 2 characters.');
  }

  if (body.qualification !== undefined && body.qualification.trim().length < 2) {
    errors.push('Qualification credentials must be at least 2 characters.');
  }

  if (body.consultation_fee !== undefined && (isNaN(body.consultation_fee) || parseFloat(body.consultation_fee) < 0)) {
    errors.push('Consultation fee must be a valid positive number.');
  }

  if (body.status !== undefined && !validStatuses.includes(body.status)) {
    errors.push('Doctor status must be one of: active, inactive, on_leave, suspended.');
  }

  return errors;
}

function validateDoctorStatus(body) {
  const errors = [];
  if (!body.status || !validStatuses.includes(body.status)) {
    errors.push('Status is required and must be one of: active, inactive, on_leave, suspended.');
  }
  return errors;
}

function validateDoctorSchedules(body) {
  const errors = [];
  if (!body.schedules || !Array.isArray(body.schedules) || body.schedules.length === 0) {
    errors.push('A non-empty schedules array is required.');
    return errors;
  }

  body.schedules.forEach((s, idx) => {
    if (!s.day_of_week || !validDays.includes(s.day_of_week)) {
      errors.push(`Slot #${idx + 1}: Valid day of week is required.`);
    }
    if (!s.start_time || !timeRegex.test(s.start_time)) {
      errors.push(`Slot #${idx + 1}: Start time must be in HH:MM or HH:MM:SS format.`);
    }
    if (!s.end_time || !timeRegex.test(s.end_time)) {
      errors.push(`Slot #${idx + 1}: End time must be in HH:MM or HH:MM:SS format.`);
    }
  });

  return errors;
}

module.exports = {
  validateCreateDoctor,
  validateUpdateDoctor,
  validateDoctorStatus,
  validateDoctorSchedules
};
