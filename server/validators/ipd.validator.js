const validWardTypes = ['general', 'icu', 'ccu', 'surgical', 'pediatric', 'maternity', 'isolation', 'vip'];
const validRoomTypes = ['general_shared', 'semi_private', 'private_single', 'icu_cubicle', 'isolation_negative_pressure', 'vip_deluxe'];
const validBedTypes = ['standard_manual', 'electric_icu', 'fowler_bed', 'pediatric_cot', 'bariatric', 'delivery_bed'];
const validBedStatuses = ['available', 'occupied', 'reserved', 'cleaning', 'maintenance'];
const validAdmissionTypes = ['emergency', 'elective_planned', 'transfer_in', 'post_op'];

function validateCreateWard(body) {
  const errors = [];
  if (!body.name || body.name.trim().length === 0) {
    errors.push('Ward name is required.');
  }
  if (!body.code || body.code.trim().length === 0) {
    errors.push('Ward code is required.');
  }
  if (body.ward_type && !validWardTypes.includes(body.ward_type)) {
    errors.push(`Ward type must be one of: ${validWardTypes.join(', ')}.`);
  }
  return errors;
}

function validateCreateRoom(body) {
  const errors = [];
  if (!body.ward_id || isNaN(body.ward_id) || parseInt(body.ward_id, 10) <= 0) {
    errors.push('Valid ward ID is required.');
  }
  if (!body.room_number || body.room_number.trim().length === 0) {
    errors.push('Room number is required.');
  }
  if (body.room_type && !validRoomTypes.includes(body.room_type)) {
    errors.push(`Room type must be one of: ${validRoomTypes.join(', ')}.`);
  }
  return errors;
}

function validateCreateBed(body) {
  const errors = [];
  if (!body.ward_id || isNaN(body.ward_id) || parseInt(body.ward_id, 10) <= 0) {
    errors.push('Valid ward ID is required.');
  }
  if (!body.room_id || isNaN(body.room_id) || parseInt(body.room_id, 10) <= 0) {
    errors.push('Valid room ID is required.');
  }
  if (!body.bed_number || body.bed_number.trim().length === 0) {
    errors.push('Bed number is required.');
  }
  if (body.bed_type && !validBedTypes.includes(body.bed_type)) {
    errors.push(`Bed type must be one of: ${validBedTypes.join(', ')}.`);
  }
  return errors;
}

function validateCreateAdmission(body) {
  const errors = [];
  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('Valid patient ID is required.');
  }
  if (!body.doctor_id || isNaN(body.doctor_id) || parseInt(body.doctor_id, 10) <= 0) {
    errors.push('Valid admitting doctor ID is required.');
  }
  if (!body.department_id || isNaN(body.department_id) || parseInt(body.department_id, 10) <= 0) {
    errors.push('Valid clinical department ID is required.');
  }
  if (!body.ward_id || isNaN(body.ward_id) || parseInt(body.ward_id, 10) <= 0) {
    errors.push('Valid ward ID is required.');
  }
  if (!body.room_id || isNaN(body.room_id) || parseInt(body.room_id, 10) <= 0) {
    errors.push('Valid room ID is required.');
  }
  if (!body.bed_id || isNaN(body.bed_id) || parseInt(body.bed_id, 10) <= 0) {
    errors.push('Valid target bed ID is required.');
  }
  if (!body.admitting_diagnosis || body.admitting_diagnosis.trim().length === 0) {
    errors.push('Admitting clinical diagnosis is required.');
  }
  return errors;
}

function validatePatientTransfer(body) {
  const errors = [];
  if (!body.admission_id || isNaN(body.admission_id) || parseInt(body.admission_id, 10) <= 0) {
    errors.push('Valid active admission ID is required.');
  }
  if (!body.to_bed_id || isNaN(body.to_bed_id) || parseInt(body.to_bed_id, 10) <= 0) {
    errors.push('Destination bed ID is required.');
  }
  if (!body.transfer_reason || body.transfer_reason.trim().length === 0) {
    errors.push('Clinical reason for patient transfer is required.');
  }
  return errors;
}

function validatePatientDischarge(body) {
  const errors = [];
  if (!body.discharge_summary || body.discharge_summary.trim().length === 0) {
    errors.push('Comprehensive discharge clinical summary is required.');
  }
  if (!body.final_diagnosis || body.final_diagnosis.trim().length === 0) {
    errors.push('Final confirmed diagnosis is required.');
  }
  return errors;
}

function validateDailyRound(body) {
  const errors = [];
  if (!body.progress_notes || body.progress_notes.trim().length === 0) {
    errors.push('Daily progress clinical notes are required.');
  }
  if (!body.treatment_plan || body.treatment_plan.trim().length === 0) {
    errors.push('Updated treatment and medication plan is required.');
  }
  return errors;
}

module.exports = {
  validateCreateWard,
  validateCreateRoom,
  validateCreateBed,
  validateCreateAdmission,
  validatePatientTransfer,
  validatePatientDischarge,
  validateDailyRound
};
