const staffService = require('../services/staff.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listStaff(req, res, next) {
  try {
    const result = await staffService.listStaff(req.query);
    return sendSuccess(res, result.staff, 'Hospital staff directory retrieved successfully.', result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getStaffById(req, res, next) {
  try {
    const staff = await staffService.getStaffById(req.params.id);
    return sendSuccess(res, staff, 'Staff profile details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function addStaff(req, res, next) {
  try {
    const result = await staffService.addStaff(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateStaff(req, res, next) {
  try {
    const result = await staffService.updateStaff(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateStaffStatus(req, res, next) {
  try {
    const result = await staffService.updateStaffStatus(req.params.id, req.body.status, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function assignDepartment(req, res, next) {
  try {
    const result = await staffService.assignDepartment(req.params.id, req.body.department_id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getStaffStats(req, res, next) {
  try {
    const stats = await staffService.getStaffStats();
    return sendSuccess(res, stats, 'Hospital staff statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listStaff,
  getStaffById,
  addStaff,
  updateStaff,
  updateStaffStatus,
  assignDepartment,
  getStaffStats
};
