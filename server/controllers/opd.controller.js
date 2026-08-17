const opdService = require('../services/opd.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function getOpdDashboard(req, res, next) {
  try {
    const dashboard = await opdService.getOpdDashboard(req.query, req.user);
    return sendSuccess(res, dashboard, 'OPD live queue retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function registerWalkIn(req, res, next) {
  try {
    const result = await opdService.registerWalkInPatient(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function checkInAppointment(req, res, next) {
  try {
    const { appointment_id } = req.body;
    const result = await opdService.checkInAppointment(appointment_id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function recordVitals(req, res, next) {
  try {
    const result = await opdService.recordTriageVitals(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function callPatient(req, res, next) {
  try {
    const result = await opdService.callPatient(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function completeConsultation(req, res, next) {
  try {
    const result = await opdService.completeConsultation(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function markNoShow(req, res, next) {
  try {
    const result = await opdService.markOpdNoShow(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function reassignDoctor(req, res, next) {
  try {
    const { doctor_id } = req.body;
    const result = await opdService.reassignDoctor(req.params.id, doctor_id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOpdDashboard,
  registerWalkIn,
  checkInAppointment,
  recordVitals,
  callPatient,
  completeConsultation,
  markNoShow,
  reassignDoctor
};
