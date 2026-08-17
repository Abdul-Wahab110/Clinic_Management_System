const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
const VALID_STATUSES = ['active', 'inactive', 'deceased', 'suspended'];
const VALID_MARITAL = ['single', 'married', 'divorced', 'widowed', 'other'];

const phoneRegex = /^[\d+\-() ]{7,20}$/;

/**
 * Validate New Patient Registration / Creation
 */
function validateCreatePatient(body) {
  const errors = [];

  // Name Normalization (Accepts full_name or first_name + last_name)
  if ((!body.first_name || !body.last_name) && body.full_name) {
    const parts = body.full_name.trim().split(/\s+/);
    body.first_name = body.first_name || parts[0] || 'Patient';
    body.last_name = body.last_name || parts.slice(1).join(' ') || parts[0] || 'User';
  }

  if (!body.first_name || body.first_name.trim().length < 2) {
    errors.push('First name is required and must be at least 2 characters.');
  }
  if (!body.last_name || body.last_name.trim().length < 2) {
    errors.push('Last name is required and must be at least 2 characters.');
  }

  // Gender Normalization (Case-insensitive)
  if (body.gender) {
    body.gender = body.gender.toLowerCase().trim();
  }
  if (!body.gender || !VALID_GENDERS.includes(body.gender)) {
    errors.push(`Gender is required and must be one of: ${VALID_GENDERS.join(', ')}.`);
  }

  // Date of Birth Normalization (Supports YYYY-MM-DD and DD/MM/YYYY)
  if (body.date_of_birth) {
    const dobStr = String(body.date_of_birth).trim();
    if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(dobStr)) {
      const parts = dobStr.split(/[\/\-\.]/);
      body.date_of_birth = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  if (!body.date_of_birth || !dateRegex.test(body.date_of_birth)) {
    errors.push('Date of birth is required in valid YYYY-MM-DD format.');
  } else {
    const dob = new Date(body.date_of_birth);
    if (isNaN(dob.getTime()) || dob > new Date()) {
      errors.push('Date of birth must be a valid date in the past.');
    }
  }

  // Phone Number (Supports Pakistani format e.g. 03212345676, +923212345676, and international)
  if (!body.phone || !phoneRegex.test(body.phone.trim()) || body.phone.replace(/\D/g, '').length < 7) {
    errors.push('A valid primary contact phone number is required (min 7 digits, e.g. 03212345676).');
  }

  // Email (Optional)
  if (body.email && body.email.trim().length > 0 && !emailRegex.test(body.email.trim())) {
    errors.push('Please provide a valid email address (e.g. name@example.com).');
  }

  // Blood Group (Optional, case-insensitive)
  if (body.blood_group) {
    const match = VALID_BLOOD_GROUPS.find(bg => bg.toLowerCase() === body.blood_group.trim().toLowerCase());
    if (match) {
      body.blood_group = match;
    } else {
      errors.push(`Blood group must be one of: ${VALID_BLOOD_GROUPS.join(', ')}.`);
    }
  }

  // Status (Optional, defaults to active)
  if (body.status && !VALID_STATUSES.includes(body.status.toLowerCase())) {
    errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}.`);
  }

  // Marital Status (Optional)
  if (body.marital_status && !VALID_MARITAL.includes(body.marital_status.toLowerCase())) {
    errors.push(`Marital status must be one of: ${VALID_MARITAL.join(', ')}.`);
  }

  // Emergency contact phone (Optional, check length if provided)
  if (body.emergency_contact_phone && (!phoneRegex.test(body.emergency_contact_phone.trim()) || body.emergency_contact_phone.replace(/\D/g, '').length < 7)) {
    errors.push('Emergency contact phone must be at least 7 digits.');
  }

  return errors;
}

/**
 * Validate Patient Profile Updates
 */
function validateUpdatePatient(body) {
  const errors = [];

  if (body.first_name !== undefined && body.first_name.trim().length < 2) {
    errors.push('First name must be at least 2 characters.');
  }
  if (body.last_name !== undefined && body.last_name.trim().length < 2) {
    errors.push('Last name must be at least 2 characters.');
  }
  if (body.gender !== undefined) {
    body.gender = body.gender.toLowerCase().trim();
    if (!VALID_GENDERS.includes(body.gender)) {
      errors.push(`Gender must be one of: ${VALID_GENDERS.join(', ')}.`);
    }
  }
  if (body.date_of_birth !== undefined) {
    const dobStr = String(body.date_of_birth).trim();
    if (/^\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}$/.test(dobStr)) {
      const parts = dobStr.split(/[\/\-\.]/);
      body.date_of_birth = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (!dateRegex.test(body.date_of_birth)) {
      errors.push('Date of birth must be in YYYY-MM-DD format.');
    } else {
      const dob = new Date(body.date_of_birth);
      if (isNaN(dob.getTime()) || dob > new Date()) {
        errors.push('Date of birth must be a valid date in the past.');
      }
    }
  }
  if (body.phone !== undefined && (!phoneRegex.test(body.phone.trim()) || body.phone.replace(/\D/g, '').length < 7)) {
    errors.push('Primary phone number must be at least 7 digits.');
  }
  if (body.email && body.email.trim().length > 0 && !emailRegex.test(body.email.trim())) {
    errors.push('Please provide a valid email address.');
  }
  if (body.blood_group !== undefined) {
    const match = VALID_BLOOD_GROUPS.find(bg => bg.toLowerCase() === body.blood_group.trim().toLowerCase());
    if (match) {
      body.blood_group = match;
    } else {
      errors.push(`Blood group must be one of: ${VALID_BLOOD_GROUPS.join(', ')}.`);
    }
  }
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status.toLowerCase())) {
    errors.push(`Status must be one of: ${VALID_STATUSES.join(', ')}.`);
  }
  if (body.marital_status !== undefined && !VALID_MARITAL.includes(body.marital_status.toLowerCase())) {
    errors.push(`Marital status must be one of: ${VALID_MARITAL.join(', ')}.`);
  }

  return errors;
}

/**
 * Validate Status Toggle
 */
function validatePatientStatus(body) {
  const errors = [];
  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    errors.push(`Status is required and must be one of: ${VALID_STATUSES.join(', ')}.`);
  }
  return errors;
}

/**
 * Validate Medical Document Upload/Addition
 */
function validateAddDocument(body) {
  const errors = [];
  if (!body.document_name || body.document_name.trim().length < 2) {
    errors.push('Document name is required (min 2 characters).');
  }
  if (!body.document_type || body.document_type.trim().length < 2) {
    errors.push('Document type is required (e.g. Diagnostic Report, Radiology Scan, Identity Document).');
  }
  if (!body.file_path || body.file_path.trim().length === 0) {
    errors.push('File path or document reference is required.');
  }
  return errors;
}

/**
 * Validate EMR Medical Record Entry
 */
function validateAddMedicalRecord(body) {
  const errors = [];
  if (!body.chief_complaint || body.chief_complaint.trim().length < 3) {
    errors.push('Chief complaint is required (min 3 characters).');
  }
  if (!body.diagnosis || body.diagnosis.trim().length < 3) {
    errors.push('Clinical diagnosis is required (min 3 characters).');
  }
  return errors;
}

/**
 * Validate Prescription Entry
 */
function validateAddPrescription(body) {
  const errors = [];
  if (!body.medicine_name || body.medicine_name.trim().length < 2) {
    errors.push('Medicine name is required.');
  }
  if (!body.dosage || body.dosage.trim().length < 1) {
    errors.push('Dosage is required (e.g. 500mg, 10ml).');
  }
  if (!body.frequency || body.frequency.trim().length < 1) {
    errors.push('Frequency is required (e.g. Twice daily, Once at bedtime).');
  }
  if (!body.duration || body.duration.trim().length < 1) {
    errors.push('Duration is required (e.g. 7 Days, 30 Days).');
  }
  return errors;
}

/**
 * Validate Vitals Recording
 */
function validateAddVitals(body) {
  const errors = [];
  if (body.systolic !== undefined && (isNaN(body.systolic) || body.systolic < 40 || body.systolic > 300)) {
    errors.push('Systolic BP must be between 40 and 300 mmHg.');
  }
  if (body.diastolic !== undefined && (isNaN(body.diastolic) || body.diastolic < 20 || body.diastolic > 200)) {
    errors.push('Diastolic BP must be between 20 and 200 mmHg.');
  }
  if (body.heart_rate !== undefined && (isNaN(body.heart_rate) || body.heart_rate < 30 || body.heart_rate > 250)) {
    errors.push('Heart rate must be between 30 and 250 bpm.');
  }
  if (body.temperature !== undefined && (isNaN(body.temperature) || body.temperature < 85 || body.temperature > 115)) {
    errors.push('Temperature must be between 85 and 115 °F.');
  }
  if (body.oxygen_saturation !== undefined && (isNaN(body.oxygen_saturation) || body.oxygen_saturation < 50 || body.oxygen_saturation > 100)) {
    errors.push('Oxygen saturation (SpO2) must be between 50% and 100%.');
  }
  return errors;
}

module.exports = {
  validateCreatePatient,
  validateUpdatePatient,
  validatePatientStatus,
  validateAddDocument,
  validateAddMedicalRecord,
  validateAddPrescription,
  validateAddVitals
};
