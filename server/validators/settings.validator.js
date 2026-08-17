function validateUpdateSettings(body) {
  const errors = [];

  if (body.hospital_name !== undefined && body.hospital_name.trim().length < 2) {
    errors.push('Hospital name must be at least 2 characters.');
  }

  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (body.phone !== undefined && body.phone.trim().length < 3) {
    errors.push('A valid contact phone number is required.');
  }

  if (body.appointment_duration_minutes !== undefined) {
    const dur = parseInt(body.appointment_duration_minutes, 10);
    if (isNaN(dur) || dur < 5 || dur > 180) {
      errors.push('Appointment duration must be between 5 and 180 minutes.');
    }
  }

  if (body.max_advance_booking_days !== undefined) {
    const days = parseInt(body.max_advance_booking_days, 10);
    if (isNaN(days) || days < 1 || days > 365) {
      errors.push('Max advance booking days must be between 1 and 365 days.');
    }
  }

  if (body.cancellation_lead_hours !== undefined) {
    const hours = parseInt(body.cancellation_lead_hours, 10);
    if (isNaN(hours) || hours < 0 || hours > 168) {
      errors.push('Cancellation lead hours must be between 0 and 168 hours.');
    }
  }

  return errors;
}

module.exports = {
  validateUpdateSettings
};
