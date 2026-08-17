const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
const validStatuses = ['pending', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'];
const validTypes = ['general', 'follow_up', 'emergency', 'consultation'];

function validateBookAppointment(body) {
  const errors = [];
  if (!body.department_id || isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0) {
    errors.push('A valid department is required.');
  }
  if (!body.appointment_date || !dateRegex.test(body.appointment_date)) {
    errors.push('Appointment date is required and must be in YYYY-MM-DD format.');
  }
  if (body.appointment_time && !timeRegex.test(body.appointment_time)) {
    errors.push('Appointment time must be in HH:MM format.');
  }
  if (!body.reason || body.reason.trim().length === 0) {
    errors.push('Medical reason / chief complaint is required.');
  }
  if (body.type && !validTypes.includes(body.type)) {
    errors.push(`Appointment type must be one of: ${validTypes.join(', ')}.`);
  }

  // Patient validation: either patient_id or first_name + last_name + phone
  if (!body.patient_id) {
    if (!body.first_name || body.first_name.trim().length === 0) {
      errors.push('Patient first name is required for new registration.');
    }
    if (!body.last_name || body.last_name.trim().length === 0) {
      errors.push('Patient last name is required for new registration.');
    }
    if (!body.phone || body.phone.trim().length < 7) {
      errors.push('Valid mobile phone number is required.');
    }
  }

  return errors;
}

function validateRescheduleAppointment(body) {
  const errors = [];
  if (!body.appointment_date || !dateRegex.test(body.appointment_date)) {
    errors.push('New appointment date is required and must be in YYYY-MM-DD format.');
  }
  if (!body.appointment_time || !timeRegex.test(body.appointment_time)) {
    errors.push('New appointment time is required and must be in HH:MM format.');
  }
  if (body.doctor_id && (isNaN(body.doctor_id) || parseInt(body.doctor_id, 10) <= 0)) {
    errors.push('If changing doctor, a valid doctor ID is required.');
  }
  return errors;
}

function validateUpdateAppointmentStatus(body) {
  const errors = [];
  if (!body.status || !validStatuses.includes(body.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }
  if (body.status === 'cancelled' && body.cancellation_reason && body.cancellation_reason.length > 255) {
    errors.push('Cancellation reason cannot exceed 255 characters.');
  }
  return errors;
}

function validateListAppointments(query) {
  const errors = [];
  if (query.status && query.status !== 'all' && !validStatuses.includes(query.status)) {
    errors.push(`Filter status must be one of: all, ${validStatuses.join(', ')}.`);
  }
  if (query.page && (isNaN(query.page) || parseInt(query.page, 10) < 1)) {
    errors.push('Page must be a positive integer.');
  }
  if (query.limit && (isNaN(query.limit) || parseInt(query.limit, 10) < 1 || parseInt(query.limit, 10) > 100)) {
    errors.push('Limit must be between 1 and 100.');
  }
  return errors;
}

module.exports = {
  validateBookAppointment,
  validateAppointmentBooking: validateBookAppointment, // alias
  validateRescheduleAppointment,
  validateUpdateAppointmentStatus,
  validateListAppointments
};
