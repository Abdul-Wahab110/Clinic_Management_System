const validArrivalModes = ['ambulance', 'walk_in', 'helicopter', 'wheelchair', 'police_referral'];
const validPriorities = ['critical', 'high', 'medium', 'low'];
const validAcuityScores = ['1', '2', '3', '4', '5'];
const validNoteTypes = [
  'triage_note',
  'primary_survey',
  'secondary_survey',
  'physician_assessment',
  'resuscitation_note',
  'procedure_note',
  'discharge_summary'
];
const validTreatmentTypes = [
  'medication',
  'iv_fluid',
  'oxygen_therapy',
  'wound_care_suture',
  'cardiac_defibrillation',
  'cpr_resuscitation',
  'splinting',
  'intubation',
  'diagnostic_order'
];

function validateRegisterEmergencyVisit(body) {
  const errors = [];
  if (!body.patient_id && (!body.first_name || body.first_name.trim().length === 0)) {
    errors.push('Either existing patient ID or patient first name is required for emergency intake.');
  }
  if (!body.chief_complaint || body.chief_complaint.trim().length === 0) {
    errors.push('Emergency chief complaint / presentation symptoms are required.');
  }
  if (body.arrival_mode && !validArrivalModes.includes(body.arrival_mode)) {
    errors.push(`Arrival mode must be one of: ${validArrivalModes.join(', ')}.`);
  }
  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Emergency priority must be one of: ${validPriorities.join(', ')}.`);
  }
  if (body.triage_acuity_score && !validAcuityScores.includes(String(body.triage_acuity_score))) {
    errors.push('Triage acuity score (ESI) must be between 1 (Resuscitation) and 5 (Non-urgent).');
  }
  return errors;
}

function validateTriageAssessment(body) {
  const errors = [];
  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Emergency priority must be one of: ${validPriorities.join(', ')}.`);
  }
  if (body.triage_acuity_score && !validAcuityScores.includes(String(body.triage_acuity_score))) {
    errors.push('Triage acuity score (ESI) must be between 1 and 5.');
  }
  return errors;
}

function validateEmergencyClinicalNote(body) {
  const errors = [];
  if (!body.emergency_visit_id || isNaN(body.emergency_visit_id) || parseInt(body.emergency_visit_id, 10) <= 0) {
    errors.push('Valid emergency visit ID is required.');
  }
  if (!body.note_type || !validNoteTypes.includes(body.note_type)) {
    errors.push(`Note type must be one of: ${validNoteTypes.join(', ')}.`);
  }
  if (!body.clinical_findings || body.clinical_findings.trim().length === 0) {
    errors.push('Clinical assessment findings are required.');
  }
  return errors;
}

function validateEmergencyTreatment(body) {
  const errors = [];
  if (!body.emergency_visit_id || isNaN(body.emergency_visit_id) || parseInt(body.emergency_visit_id, 10) <= 0) {
    errors.push('Valid emergency visit ID is required.');
  }
  if (!body.treatment_type || !validTreatmentTypes.includes(body.treatment_type)) {
    errors.push(`Treatment type must be one of: ${validTreatmentTypes.join(', ')}.`);
  }
  if (!body.description || body.description.trim().length === 0) {
    errors.push('Treatment description is required.');
  }
  return errors;
}

function validateAdmitToIpd(body) {
  const errors = [];
  if (!body.ward_id || isNaN(body.ward_id) || parseInt(body.ward_id, 10) <= 0) {
    errors.push('Target inpatient ward ID is required.');
  }
  if (!body.bed_id || isNaN(body.bed_id) || parseInt(body.bed_id, 10) <= 0) {
    errors.push('Target inpatient bed ID is required.');
  }
  return errors;
}

module.exports = {
  validateRegisterEmergencyVisit,
  validateTriageAssessment,
  validateEmergencyClinicalNote,
  validateEmergencyTreatment,
  validateAdmitToIpd
};
