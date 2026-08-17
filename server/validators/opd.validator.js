const validTypes = ['appointment', 'walk_in', 'emergency'];
const validPriorities = ['normal', 'urgent', 'emergency'];
const validStatuses = ['waiting', 'in_consultation', 'completed', 'no_show', 'cancelled'];

function validateRegisterWalkIn(body) {
  const errors = [];
  if (!body.department_id || isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0) {
    errors.push('A valid clinical department is required.');
  }
  if (!body.doctor_id || isNaN(body.doctor_id) || parseInt(body.doctor_id, 10) <= 0) {
    errors.push('A valid attending doctor is required.');
  }

  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}.`);
  }

  // Patient: either patient_id OR first_name + last_name + phone
  if (!body.patient_id) {
    if (!body.first_name || body.first_name.trim().length === 0) {
      errors.push('Patient first name is required.');
    }
    if (!body.last_name || body.last_name.trim().length === 0) {
      errors.push('Patient last name is required.');
    }
    if (!body.phone || body.phone.trim().length < 7) {
      errors.push('Valid patient mobile phone is required.');
    }
  }

  return errors;
}

function validateCheckInAppointment(body) {
  const errors = [];
  if (!body.appointment_id || isNaN(body.appointment_id) || parseInt(body.appointment_id, 10) <= 0) {
    errors.push('A valid appointment ID is required for check-in.');
  }
  return errors;
}

function validateRecordVitals(body) {
  const errors = [];
  if (body.systolic && (isNaN(body.systolic) || body.systolic < 50 || body.systolic > 260)) {
    errors.push('Systolic blood pressure must be between 50 and 260 mmHg.');
  }
  if (body.diastolic && (isNaN(body.diastolic) || body.diastolic < 30 || body.diastolic > 180)) {
    errors.push('Diastolic blood pressure must be between 30 and 180 mmHg.');
  }
  if (body.heart_rate && (isNaN(body.heart_rate) || body.heart_rate < 30 || body.heart_rate > 240)) {
    errors.push('Heart rate must be between 30 and 240 bpm.');
  }
  if (body.temperature && (isNaN(body.temperature) || body.temperature < 85 || body.temperature > 110)) {
    errors.push('Temperature must be between 85 and 110 °F.');
  }
  if (body.oxygen_saturation && (isNaN(body.oxygen_saturation) || body.oxygen_saturation < 50 || body.oxygen_saturation > 100)) {
    errors.push('Oxygen saturation (SPO2) must be between 50% and 100%.');
  }
  if (body.weight_kg && (isNaN(body.weight_kg) || body.weight_kg <= 0 || body.weight_kg > 400)) {
    errors.push('Weight must be a positive number in kg.');
  }
  if (body.height_cm && (isNaN(body.height_cm) || body.height_cm <= 0 || body.height_cm > 300)) {
    errors.push('Height must be a positive number in cm.');
  }
  return errors;
}

function validateCompleteConsultation(body) {
  const errors = [];
  if (!body.diagnosis || body.diagnosis.trim().length === 0) {
    errors.push('Primary clinical diagnosis is required to conclude consultation.');
  }
  return errors;
}

module.exports = {
  validateRegisterWalkIn,
  validateCheckInAppointment,
  validateRecordVitals,
  validateCompleteConsultation
};
