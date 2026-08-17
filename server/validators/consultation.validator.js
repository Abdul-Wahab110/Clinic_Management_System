function validateSaveConsultation(body) {
  const errors = [];

  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('A valid patient ID is required.');
  }

  if (!body.chief_complaint || body.chief_complaint.trim().length === 0) {
    errors.push('Chief medical complaint is required.');
  }

  if (!body.diagnosis || body.diagnosis.trim().length === 0) {
    errors.push('Clinical diagnosis / assessment is required.');
  }

  // Vitals validation if provided
  if (body.vitals) {
    const v = body.vitals;
    if (v.systolic && (isNaN(v.systolic) || v.systolic < 50 || v.systolic > 260)) {
      errors.push('Systolic BP must be between 50 and 260 mmHg.');
    }
    if (v.diastolic && (isNaN(v.diastolic) || v.diastolic < 30 || v.diastolic > 180)) {
      errors.push('Diastolic BP must be between 30 and 180 mmHg.');
    }
    if (v.heart_rate && (isNaN(v.heart_rate) || v.heart_rate < 30 || v.heart_rate > 240)) {
      errors.push('Pulse / Heart rate must be between 30 and 240 bpm.');
    }
    if (v.temperature && (isNaN(v.temperature) || v.temperature < 85 || v.temperature > 110)) {
      errors.push('Body temperature must be between 85 and 110 °F.');
    }
    if (v.oxygen_saturation && (isNaN(v.oxygen_saturation) || v.oxygen_saturation < 50 || v.oxygen_saturation > 100)) {
      errors.push('Oxygen saturation (SPO2) must be between 50% and 100%.');
    }
    if (v.weight_kg && (isNaN(v.weight_kg) || v.weight_kg <= 0 || v.weight_kg > 400)) {
      errors.push('Weight must be a valid positive number in kg.');
    }
    if (v.height_cm && (isNaN(v.height_cm) || v.height_cm <= 0 || v.height_cm > 300)) {
      errors.push('Height must be a valid positive number in cm.');
    }
  }

  // Prescriptions validation if provided
  if (body.prescriptions && Array.isArray(body.prescriptions)) {
    body.prescriptions.forEach((rx, idx) => {
      if (!rx.medicine_name || rx.medicine_name.trim().length === 0) {
        errors.push(`Prescription item #${idx + 1} requires a medicine name.`);
      }
      if (!rx.dosage || rx.dosage.trim().length === 0) {
        errors.push(`Prescription item #${idx + 1} requires a dosage (e.g. 500mg).`);
      }
    });
  }

  return errors;
}

module.exports = {
  validateSaveConsultation
};
