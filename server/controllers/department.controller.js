const departmentService = require('../services/department.service');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');

async function getDepartments(req, res, next) {
  try {
    const {
      search,
      status,
      emergency_only,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const result = await departmentService.getDepartments(
      { search, status, emergency_only, sortBy, sortOrder },
      { page, limit }
    );

    return sendPaginated(
      res,
      result.departments,
      result.pagination.total,
      result.pagination.page,
      result.pagination.limit,
      'Departments retrieved successfully.'
    );
  } catch (error) {
    next(error);
  }
}

async function getDepartmentById(req, res, next) {
  try {
    const dept = await departmentService.getDepartmentById(req.params.id);
    if (!dept) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }
    return sendSuccess(res, dept, 'Department details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createDepartment(req, res, next) {
  try {
    const dept = await departmentService.createDepartment(req.body, req.user);
    return sendCreated(res, dept, `Department "${dept.name}" created successfully.`);
  } catch (error) {
    next(error);
  }
}

async function updateDepartment(req, res, next) {
  try {
    const dept = await departmentService.updateDepartment(req.params.id, req.body, req.user);
    return sendSuccess(res, dept, `Department "${dept.name}" updated successfully.`);
  } catch (error) {
    next(error);
  }
}

async function updateDepartmentStatus(req, res, next) {
  try {
    const { is_active } = req.body;
    const result = await departmentService.updateDepartmentStatus(req.params.id, is_active, req.user);
    return sendSuccess(res, result, `Department status updated to ${is_active ? 'Active' : 'Inactive'}.`);
  } catch (error) {
    next(error);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const { fallback_department_id } = req.body || {};
    const result = await departmentService.deleteDepartment(req.params.id, fallback_department_id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function assignDoctorToDepartment(req, res, next) {
  try {
    const { doctor_id } = req.body;
    const result = await departmentService.assignDoctorToDepartment(req.params.id, doctor_id, req.user);
    return sendSuccess(res, result, 'Doctor assigned to department successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDepartmentDoctors(req, res, next) {
  try {
    const doctors = await departmentService.getDepartmentDoctors(req.params.id);
    return sendSuccess(res, doctors, 'Department doctors retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDepartmentStats(req, res, next) {
  try {
    const stats = await departmentService.getDepartmentStats();
    return sendSuccess(res, stats, 'Department statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  updateDepartmentStatus,
  deleteDepartment,
  assignDoctorToDepartment,
  getDepartmentDoctors,
  getDepartmentStats
};
