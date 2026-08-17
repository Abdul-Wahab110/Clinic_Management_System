const appointmentService = require('../services/appointment.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listAppointments(req, res, next) {
  try {
    const result = await appointmentService.listAppointments(req.query, req.user);
    return sendSuccess(res, result.appointments, 'Appointments retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getAppointmentStats(req, res, next) {
  try {
    const stats = await appointmentService.getAppointmentStats(req.user);
    return sendSuccess(res, stats, 'Appointment statistics calculated successfully.');
  } catch (error) {
    next(error);
  }
}

async function getAppointmentById(req, res, next) {
  try {
    const appointment = await appointmentService.getAppointmentById(req.params.id, req.user);
    return sendSuccess(res, appointment, 'Appointment details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function bookAppointment(req, res, next) {
  try {
    const result = await appointmentService.bookAppointment(req.body, req.user, req.ip, req.get('user-agent'));
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function rescheduleAppointment(req, res, next) {
  try {
    const result = await appointmentService.rescheduleAppointment(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateAppointmentStatus(req, res, next) {
  try {
    const result = await appointmentService.updateAppointmentStatus(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function approveAppointment(req, res, next) {
  try {
    const result = await appointmentService.approveAppointment(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function rejectAppointment(req, res, next) {
  try {
    const { rejection_reason } = req.body;
    const result = await appointmentService.rejectAppointment(req.params.id, rejection_reason, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getAvailableSlots(req, res, next) {
  try {
    const { doctor_id, date } = req.query;
    const result = await appointmentService.getAvailableSlots(doctor_id, date);
    return sendSuccess(res, result, 'Available slots calculated.');
  } catch (error) {
    next(error);
  }
}

async function deleteAppointment(req, res, next) {
  try {
    const result = await appointmentService.deleteAppointment(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAppointments,
  getAppointmentStats,
  getAppointmentById,
  bookAppointment,
  rescheduleAppointment,
  updateAppointmentStatus,
  deleteAppointment,
  approveAppointment,
  rejectAppointment,
  getAvailableSlots
};
