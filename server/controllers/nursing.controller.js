const nursingService = require('../services/nursing.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function getAssignedPatients(req, res, next) {
  try {
    const patients = await nursingService.getAssignedPatients(req.user, req.query);
    return sendSuccess(res, patients, 'Assigned inpatient nursing roster retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPatientNursingSummary(req, res, next) {
  try {
    const summary = await nursingService.getPatientNursingSummary(req.params.id, req.user);
    return sendSuccess(res, summary, 'Patient nursing chart and clinical summary retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function recordNursingNote(req, res, next) {
  try {
    const result = await nursingService.recordNursingNote(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listNursingNotes(req, res, next) {
  try {
    const notes = await nursingService.listNursingNotes(req.params.patientId, req.query, req.user);
    return sendSuccess(res, notes, 'Nursing clinical notes retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function recordMedicationAdministration(req, res, next) {
  try {
    const result = await nursingService.recordMedicationAdministration(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function recordVitals(req, res, next) {
  try {
    const result = await nursingService.recordVitals(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listWardTasks(req, res, next) {
  try {
    const tasks = await nursingService.listWardTasks(req.query, req.user);
    return sendSuccess(res, tasks, 'Ward nursing tasks retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createWardTask(req, res, next) {
  try {
    const result = await nursingService.createWardTask(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function completeWardTask(req, res, next) {
  try {
    const result = await nursingService.completeWardTask(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getNursingStats(req, res, next) {
  try {
    const stats = await nursingService.getNursingStats(req.user);
    return sendSuccess(res, stats, 'Nursing station statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAssignedPatients,
  getPatientNursingSummary,
  recordNursingNote,
  listNursingNotes,
  recordMedicationAdministration,
  recordVitals,
  listWardTasks,
  createWardTask,
  completeWardTask,
  getNursingStats
};
