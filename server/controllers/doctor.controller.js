const doctorService = require('../services/doctor.service');
const { sendSuccess, sendCreated, sendPaginated } = require('../utils/response');

async function getDoctors(req, res, next) {
  try {
    const {
      search,
      department_id,
      specialization,
      status,
      min_fee,
      max_fee,
      min_experience,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const result = await doctorService.getDoctors(
      { search, department_id, specialization, status, min_fee, max_fee, min_experience, sortBy, sortOrder },
      { page, limit }
    );

    return sendPaginated(
      res,
      result.doctors,
      result.pagination.total,
      result.pagination.page,
      result.pagination.limit,
      'Doctors directory retrieved successfully.'
    );
  } catch (error) {
    next(error);
  }
}

async function getDoctorById(req, res, next) {
  try {
    const doctor = await doctorService.getDoctorById(req.params.id);
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found.' });
    }
    return sendSuccess(res, doctor, 'Doctor profile retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createDoctor(req, res, next) {
  try {
    const doctor = await doctorService.createDoctor(req.body, req.user);
    return sendCreated(res, doctor, 'Doctor profile and user account created successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctor(req, res, next) {
  try {
    const doctor = await doctorService.updateDoctor(req.params.id, req.body, req.user);
    return sendSuccess(res, doctor, 'Doctor profile updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctorStatus(req, res, next) {
  try {
    const { status } = req.body;
    const result = await doctorService.updateDoctorStatus(req.params.id, status, req.user);
    return sendSuccess(res, result, `Doctor status updated to "${status}" successfully.`);
  } catch (error) {
    next(error);
  }
}

async function getDoctorSchedules(req, res, next) {
  try {
    const schedules = await doctorService.getDoctorSchedules(req.params.id);
    return sendSuccess(res, schedules, 'Doctor weekly schedule retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctorSchedules(req, res, next) {
  try {
    const schedules = await doctorService.updateDoctorSchedules(req.params.id, req.body.schedules, req.user);
    return sendSuccess(res, schedules, 'Doctor weekly schedule updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function deleteDoctor(req, res, next) {
  try {
    const result = await doctorService.deleteDoctor(req.params.id, req.user);
    return sendSuccess(res, result, 'Doctor deactivated successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDoctorStats(req, res, next) {
  try {
    const stats = await doctorService.getDoctorStats();
    return sendSuccess(res, stats, 'Doctor statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDepartments(req, res, next) {
  try {
    const departments = await doctorService.getDepartments();
    return sendSuccess(res, departments, 'Departments retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDoctors,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  getDoctorSchedules,
  updateDoctorSchedules,
  deleteDoctor,
  getDoctorStats,
  getDepartments
};
