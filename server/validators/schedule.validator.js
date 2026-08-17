const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const validLeaveTypes = ['annual', 'sick', 'conference', 'emergency', 'casual', 'blocked_time'];
const validLeaveStatuses = ['pending', 'approved', 'rejected', 'cancelled'];

function validateGetAvailability(query) {
  const errors = [];
  if (!query.doctor_id || isNaN(query.doctor_id) || parseInt(query.doctor_id, 10) <= 0) {
    errors.push('A valid doctor ID is required.');
  }
  if (!query.date || !dateRegex.test(query.date)) {
    errors.push('A valid target date in YYYY-MM-DD format is required.');
  }
  return errors;
}

function validateUpdateSchedules(body) {
  const errors = [];
  if (!body.schedules || !Array.isArray(body.schedules) || body.schedules.length === 0) {
    errors.push('A non-empty schedules array is required.');
    return errors;
  }

  body.schedules.forEach((s, idx) => {
    const prefix = `Slot #${idx + 1} (${s.day_of_week || 'Unknown'}):`;
    if (!s.day_of_week || !validDays.includes(s.day_of_week)) {
      errors.push(`${prefix} Valid day of week is required.`);
    }
    if (!s.start_time || !timeRegex.test(s.start_time)) {
      errors.push(`${prefix} Valid start time (HH:MM) is required.`);
    }
    if (!s.end_time || !timeRegex.test(s.end_time)) {
      errors.push(`${prefix} Valid end time (HH:MM) is required.`);
    }
    if (s.start_time && s.end_time && s.start_time >= s.end_time) {
      errors.push(`${prefix} Start time must be strictly before end time.`);
    }
    if (s.break_start_time && s.break_end_time) {
      if (!timeRegex.test(s.break_start_time) || !timeRegex.test(s.break_end_time)) {
        errors.push(`${prefix} Break times must be in valid HH:MM format.`);
      }
      if (s.break_start_time >= s.break_end_time) {
        errors.push(`${prefix} Break start time must be before break end time.`);
      }
      if (s.break_start_time < s.start_time || s.break_end_time > s.end_time) {
        errors.push(`${prefix} Break interval must fall within the working shift hours.`);
      }
    }
    if (s.slot_duration_minutes !== undefined && (isNaN(s.slot_duration_minutes) || s.slot_duration_minutes < 5 || s.slot_duration_minutes > 180)) {
      errors.push(`${prefix} Consultation duration must be between 5 and 180 minutes.`);
    }
  });

  return errors;
}

function validateCreateLeave(body) {
  const errors = [];
  if (!body.doctor_id || isNaN(body.doctor_id) || parseInt(body.doctor_id, 10) <= 0) {
    errors.push('A valid doctor ID is required.');
  }
  if (!body.start_date || !dateRegex.test(body.start_date)) {
    errors.push('Start date in YYYY-MM-DD format is required.');
  }
  if (!body.end_date || !dateRegex.test(body.end_date)) {
    errors.push('End date in YYYY-MM-DD format is required.');
  }
  if (body.start_date && body.end_date && body.start_date > body.end_date) {
    errors.push('Start date cannot be after end date.');
  }
  if (body.leave_type && !validLeaveTypes.includes(body.leave_type)) {
    errors.push(`Leave type must be one of: ${validLeaveTypes.join(', ')}.`);
  }
  if (body.is_full_day === false || body.is_full_day === 0) {
    if (!body.start_time || !timeRegex.test(body.start_time) || !body.end_time || !timeRegex.test(body.end_time)) {
      errors.push('Partial-day leave requires valid start_time and end_time (HH:MM).');
    }
  }
  return errors;
}

function validateLeaveStatus(body) {
  const errors = [];
  if (!body.status || !validLeaveStatuses.includes(body.status)) {
    errors.push(`Leave status must be one of: ${validLeaveStatuses.join(', ')}.`);
  }
  return errors;
}

module.exports = {
  validateGetAvailability,
  validateUpdateSchedules,
  validateCreateLeave,
  validateLeaveStatus
};
