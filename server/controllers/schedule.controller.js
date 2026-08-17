const scheduleService = require('../services/schedule.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function getDoctorAvailability(req, res, next) {
  try {
    const { doctor_id, date } = req.query;
    const availability = await scheduleService.calculateDoctorAvailability(doctor_id, date);
    return sendSuccess(res, availability, 'Doctor availability calculated successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDoctorSchedules(req, res, next) {
  try {
    const schedules = await scheduleService.getDoctorSchedules(req.params.id);
    return sendSuccess(res, schedules, 'Doctor weekly schedules retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctorSchedules(req, res, next) {
  try {
    const schedules = await scheduleService.updateDoctorSchedules(req.params.id, req.body.schedules, req.user);
    return sendSuccess(res, schedules, 'Doctor schedules updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDoctorLeaves(req, res, next) {
  try {
    const { doctor_id, status, start_date, end_date } = req.query;
    const leaves = await scheduleService.getDoctorLeaves({ doctor_id, status, start_date, end_date });
    return sendSuccess(res, leaves, 'Doctor leaves retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function applyDoctorLeave(req, res, next) {
  try {
    const result = await scheduleService.applyDoctorLeave(req.body, req.user);
    return sendCreated(res, result, 'Doctor leave/blocked date recorded successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateLeaveStatus(req, res, next) {
  try {
    const { status } = req.body;
    const result = await scheduleService.updateLeaveStatus(req.params.id, status, req.user);
    return sendSuccess(res, result, `Leave status updated to ${status}.`);
  } catch (error) {
    next(error);
  }
}

async function getAllSchedulesOverview(req, res, next) {
  try {
    const overview = await scheduleService.getAllSchedulesOverview();
    return sendSuccess(res, overview, 'Faculty schedules overview retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDoctorAvailability,
  getDoctorSchedules,
  updateDoctorSchedules,
  getDoctorLeaves,
  applyDoctorLeave,
  updateLeaveStatus,
  getAllSchedulesOverview
};
