const validStatuses = ['ordered', 'scheduled', 'in_progress', 'completed', 'verified', 'cancelled'];
const validPriorities = ['routine', 'urgent', 'stat'];

function validateCreateRadiologyService(body) {
  const errors = [];

  if (!body.name || body.name.trim().length === 0) {
    errors.push('Service name is required.');
  }

  if (!body.code || body.code.trim().length === 0) {
    errors.push('Unique service code is required.');
  }

  if (!body.modality_id || isNaN(body.modality_id) || parseInt(body.modality_id, 10) <= 0) {
    errors.push('A valid modality ID is required.');
  }

  if (body.price === undefined || isNaN(body.price) || parseFloat(body.price) < 0) {
    errors.push('A valid non-negative service price is required.');
  }

  return errors;
}

function validateCreateRadiologyOrder(body) {
  const errors = [];

  if (!body.patient_id || isNaN(body.patient_id) || parseInt(body.patient_id, 10) <= 0) {
    errors.push('A valid patient ID is required.');
  }

  if (!body.service_id || isNaN(body.service_id) || parseInt(body.service_id, 10) <= 0) {
    errors.push('A valid radiology service ID is required.');
  }

  if (!body.clinical_indication || body.clinical_indication.trim().length === 0) {
    errors.push('Clinical indication / reason for imaging is required.');
  }

  if (body.priority && !validPriorities.includes(body.priority)) {
    errors.push(`Priority must be one of: ${validPriorities.join(', ')}.`);
  }

  return errors;
}

function validateScheduleRadiologyOrder(body) {
  const errors = [];

  if (!body.scheduled_date || body.scheduled_date.trim().length === 0) {
    errors.push('Scheduled date is required.');
  }

  if (!body.scheduled_time || body.scheduled_time.trim().length === 0) {
    errors.push('Scheduled time is required.');
  }

  return errors;
}

function validateSaveRadiologyReport(body) {
  const errors = [];

  if (!body.findings || body.findings.trim().length === 0) {
    errors.push('Radiological findings are required.');
  }

  if (!body.impression || body.impression.trim().length === 0) {
    errors.push('Diagnostic impression / conclusion is required.');
  }

  return errors;
}

function validateUpdateRadiologyStatus(body) {
  const errors = [];

  if (!body.status || !validStatuses.includes(body.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(', ')}.`);
  }

  return errors;
}

module.exports = {
  validateCreateRadiologyService,
  validateCreateRadiologyOrder,
  validateScheduleRadiologyOrder,
  validateSaveRadiologyReport,
  validateUpdateRadiologyStatus
};
