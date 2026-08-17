const emergencyService = require('../services/emergency.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listEmergencyVisits(req, res, next) {
  try {
    const result = await emergencyService.listEmergencyVisits(req.query);
    return sendSuccess(res, result.visits, 'Emergency Department queue retrieved successfully.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getEmergencyVisitById(req, res, next) {
  try {
    const visit = await emergencyService.getEmergencyVisitById(req.params.id);
    return sendSuccess(res, visit, 'Emergency patient encounter details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function registerEmergencyVisit(req, res, next) {
  try {
    const result = await emergencyService.registerEmergencyVisit(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateTriage(req, res, next) {
  try {
    const result = await emergencyService.updateTriage(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function recordEmergencyClinicalNote(req, res, next) {
  try {
    const result = await emergencyService.recordEmergencyClinicalNote(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function recordEmergencyTreatment(req, res, next) {
  try {
    const result = await emergencyService.recordEmergencyTreatment(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function admitToIpd(req, res, next) {
  try {
    const result = await emergencyService.admitToIpd(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function transferPatient(req, res, next) {
  try {
    const result = await emergencyService.transferPatient(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function dischargePatient(req, res, next) {
  try {
    const result = await emergencyService.dischargePatient(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getEmergencyStats(req, res, next) {
  try {
    const stats = await emergencyService.getEmergencyStats();
    return sendSuccess(res, stats, 'Emergency Department statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listEmergencyVisits,
  getEmergencyVisitById,
  registerEmergencyVisit,
  updateTriage,
  recordEmergencyClinicalNote,
  recordEmergencyTreatment,
  admitToIpd,
  transferPatient,
  dischargePatient,
  getEmergencyStats
};
