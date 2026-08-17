const consultationService = require('../services/consultation.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function getPatientClinicalSummary(req, res, next) {
  try {
    const summary = await consultationService.getPatientClinicalSummary(req.params.patientId, req.user);
    return sendSuccess(res, summary, 'Patient clinical EMR summary retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function saveConsultationRecord(req, res, next) {
  try {
    const result = await consultationService.saveConsultationRecord(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getMedicalRecordById(req, res, next) {
  try {
    const record = await consultationService.getMedicalRecordById(req.params.id, req.user);
    return sendSuccess(res, record, 'Medical encounter record retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPatientClinicalSummary,
  saveConsultationRecord,
  getMedicalRecordById
};
