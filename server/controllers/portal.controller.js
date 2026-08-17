const db = require('../config/db');
const patientPortalService = require('../services/patientPortal.service');
const doctorPortalService = require('../services/doctorPortal.service');
const { sendSuccess } = require('../utils/response');
const { ForbiddenError, NotFoundError } = require('../utils/errors');

/**
 * 1. Patient Dashboard Overview (Real-Time Dynamic Data)
 */
async function getPatientDashboardOverview(req, res, next) {
  try {
    const result = await patientPortalService.getPatientDashboardOverview(req.user);
    return sendSuccess(res, result, 'Patient dashboard data retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Patient Appointments
 */
async function getPatientAppointments(req, res, next) {
  try {
    const result = await patientPortalService.getPatientAppointments(req.user, req.query);
    return sendSuccess(res, result, 'Patient appointments retrieved.');
  } catch (error) {
    next(error);
  }
}

async function bookPatientAppointment(req, res, next) {
  try {
    const result = await patientPortalService.bookPatientAppointment(req.user, req.body);
    return sendSuccess(res, result, result.message, 201);
  } catch (error) {
    next(error);
  }
}

async function cancelPatientAppointment(req, res, next) {
  try {
    const result = await patientPortalService.cancelPatientAppointment(req.user, req.params.id, req.body.reason);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Patient Medical History & Records
 */
async function getPatientMedicalHistory(req, res, next) {
  try {
    const result = await patientPortalService.getPatientMedicalHistory(req.user);
    return sendSuccess(res, result, 'Patient medical history retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Patient Prescriptions
 */
async function getPatientPrescriptions(req, res, next) {
  try {
    const result = await patientPortalService.getPatientPrescriptions(req.user);
    return sendSuccess(res, result, 'Patient prescriptions retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Patient Lab Reports
 */
async function getPatientLabReports(req, res, next) {
  try {
    const result = await patientPortalService.getPatientLabReports(req.user);
    return sendSuccess(res, result, 'Patient lab reports retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Patient Invoices & Billing
 */
async function getPatientInvoices(req, res, next) {
  try {
    const result = await patientPortalService.getPatientInvoices(req.user);
    return sendSuccess(res, result, 'Patient billing invoices retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 7. Patient Payments Ledger
 */
async function getPatientPayments(req, res, next) {
  try {
    const result = await patientPortalService.getPatientPayments(req.user);
    return sendSuccess(res, result, 'Patient payment history retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 8. Patient Demographic Profile
 */
async function getPatientProfile(req, res, next) {
  try {
    const patient = await patientPortalService.getPatientIdFromUser(req.user);
    return sendSuccess(res, patient, 'Patient profile details retrieved.');
  } catch (error) {
    next(error);
  }
}

async function updatePatientProfile(req, res, next) {
  try {
    const result = await patientPortalService.updatePatientProfile(req.user, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * 9. Patient Documents
 */
async function getPatientDocuments(req, res, next) {
  try {
    const result = await patientPortalService.getPatientDocuments(req.user);
    return sendSuccess(res, result, 'Patient documents retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 10. Legacy / Generic Records
 */
async function getPatientSelfRecords(req, res, next) {
  try {
    const overview = await patientPortalService.getPatientDashboardOverview(req.user);
    return sendSuccess(res, overview, 'Patient records retrieved.');
  } catch (error) {
    next(error);
  }
}

// ==========================================
// DOCTOR PORTAL CONTROLLER METHODS
// ==========================================

/**
 * 1. Doctor Dashboard Overview
 */
async function getDoctorDashboardOverview(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorDashboardOverview(req.user);
    return sendSuccess(res, result, 'Physician workspace overview retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 2. Doctor Appointments
 */
async function getDoctorAppointments(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorAppointments(req.user, req.query);
    return sendSuccess(res, result, 'Physician appointments retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 3. Doctor Patients
 */
async function getDoctorPatients(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorPatients(req.user, req.query);
    return sendSuccess(res, result, 'Physician patients directory retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 4. Doctor Consultations
 */
async function getDoctorConsultations(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorConsultations(req.user, req.query);
    return sendSuccess(res, result, 'Physician clinical consultation notes retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 5. Doctor Prescriptions
 */
async function getDoctorPrescriptions(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorPrescriptions(req.user, req.query);
    return sendSuccess(res, result, 'Physician electronic prescriptions retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 6. Doctor Lab Orders
 */
async function getDoctorLabOrders(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorLabOrders(req.user, req.query);
    return sendSuccess(res, result, 'Physician diagnostic lab orders retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 7. Doctor Follow-ups
 */
async function getDoctorFollowUps(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorFollowUps(req.user, req.query);
    return sendSuccess(res, result, 'Physician follow-up roster retrieved.');
  } catch (error) {
    next(error);
  }
}

/**
 * 8. Doctor Profile & Credentials
 */
async function getDoctorProfile(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorProfile(req.user);
    return sendSuccess(res, result, 'Physician profile retrieved.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctorProfile(req, res, next) {
  try {
    const result = await doctorPortalService.updateDoctorProfile(req.user, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * 9. Doctor Weekly Timetable & Leaves
 */
async function getDoctorSchedule(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorSchedule(req.user);
    return sendSuccess(res, result, 'Physician timetable and schedule retrieved.');
  } catch (error) {
    next(error);
  }
}

async function updateDoctorSchedule(req, res, next) {
  try {
    const result = await doctorPortalService.updateDoctorSchedule(req.user, req.body.schedules || req.body);
    return sendSuccess(res, result, 'Physician weekly timetable updated successfully.');
  } catch (error) {
    next(error);
  }
}

async function submitDoctorLeave(req, res, next) {
  try {
    const result = await doctorPortalService.submitDoctorLeave(req.user, req.body);
    return sendSuccess(res, result, result.message, 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Legacy Doctor Self Appointments
 */
async function getDoctorSelfAppointments(req, res, next) {
  try {
    const result = await doctorPortalService.getDoctorAppointments(req.user, req.query);
    const doctor = await doctorPortalService.getDoctorIdFromUser(req.user);
    const scheduleRes = await doctorPortalService.getDoctorSchedule(req.user);
    return sendSuccess(res, {
      doctorId: doctor.id,
      specialization: doctor.specialization,
      roomNumber: doctor.room_number,
      appointments: result,
      schedules: scheduleRes.schedules
    }, 'Doctor consultations retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  // Patient Portal Handlers
  getPatientDashboardOverview,
  getPatientAppointments,
  bookPatientAppointment,
  cancelPatientAppointment,
  getPatientMedicalHistory,
  getPatientPrescriptions,
  getPatientLabReports,
  getPatientInvoices,
  getPatientPayments,
  getPatientDocuments,
  getPatientProfile,
  updatePatientProfile,
  getPatientSelfRecords,
  
  // Doctor Portal Handlers
  getDoctorDashboardOverview,
  getDoctorAppointments,
  getDoctorPatients,
  getDoctorConsultations,
  getDoctorPrescriptions,
  getDoctorLabOrders,
  getDoctorFollowUps,
  getDoctorProfile,
  updateDoctorProfile,
  getDoctorSchedule,
  updateDoctorSchedule,
  submitDoctorLeave,
  getDoctorSelfAppointments
};
