const validNoteTypes = [
  'shift_handover',
  'progress_note',
  'incident_report',
  'wound_care',
  'intake_output',
  'triage_assessment',
  'doctor_instruction_acknowledgment'
];

const validPriorityLevels = ['stable', 'moderate', 'high_attention', 'critical'];
const validRoutes = ['oral', 'iv', 'im', 'sc', 'topical', 'inhalation', 'rectal', 'sublingual'];
const validEmarStatuses = ['administered', 'held', 'refused', 'delayed', 'missed'];
const validTaskTypes = [
  'vitals_check',
  'medication_due',
  'wound_dressing',
  'iv_cannula_change',
  'catheter_care',
  'blood_draw',
  'specimen_collection',
  'physiotherapy_assist',
  'doctor_order'
];

function validateCreateNursingNote(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.note_type || !validNoteTypes.includes(body.note_type)) {
    errors.push(`Note type must be one of: ${validNoteTypes.join(', ')}.`);
  }
  if (body.priority_level && !validPriorityLevels.includes(body.priority_level)) {
    errors.push(`Priority level must be one of: ${validPriorityLevels.join(', ')}.`);
  }
  if (!body.nursing_interventions || body.nursing_interventions.trim().length === 0) {
    errors.push('Nursing interventions / clinical actions are required.');
  }
  return errors;
}

function validateMedicationAdministration(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.medicine_name || body.medicine_name.trim().length === 0) {
    errors.push('Medicine name is required.');
  }
  if (!body.dosage || body.dosage.trim().length === 0) {
    errors.push('Administered dosage is required.');
  }
  if (body.route && !validRoutes.includes(body.route)) {
    errors.push(`Medication route must be one of: ${validRoutes.join(', ')}.`);
  }
  if (body.status && !validEmarStatuses.includes(body.status)) {
    errors.push(`eMAR status must be one of: ${validEmarStatuses.join(', ')}.`);
  }
  return errors;
}

function validateRecordVitals(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.blood_pressure && !body.heart_rate && !body.temperature && !body.oxygen_saturation) {
    errors.push('At least one vital sign metric (BP, HR, Temp, or SpO2) must be provided.');
  }
  return errors;
}

function validateCreateWardTask(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.ward_id || isNaN(body.ward_id) || parseInt(body.ward_id, 10) <= 0) {
    errors.push('Valid ward ID is required.');
  }
  if (!body.task_type || !validTaskTypes.includes(body.task_type)) {
    errors.push(`Task type must be one of: ${validTaskTypes.join(', ')}.`);
  }
  if (!body.description || body.description.trim().length === 0) {
    errors.push('Task description is required.');
  }
  if (!body.due_time) {
    errors.push('Task due time is required.');
  }
  return errors;
}

module.exports = {
  validateCreateNursingNote,
  validateMedicationAdministration,
  validateRecordVitals,
  validateCreateWardTask
};
