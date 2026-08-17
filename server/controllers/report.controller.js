const reportService = require('../services/report.service');
const { sendSuccess } = require('../utils/response');

async function getExecutiveOverview(req, res, next) {
  try {
    const data = await reportService.getExecutiveOverview(req.query);
    return sendSuccess(res, data, 'Executive overview report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPatientRegistrationReport(req, res, next) {
  try {
    const data = await reportService.getPatientRegistrationReport(req.query);
    return sendSuccess(res, data, 'Patient registration demographics report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getAppointmentsAndOpdReport(req, res, next) {
  try {
    const data = await reportService.getAppointmentsAndOpdReport(req.query);
    return sendSuccess(res, data, 'Appointments and OPD performance report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getIpdReport(req, res, next) {
  try {
    const data = await reportService.getIpdReport(req.query);
    return sendSuccess(res, data, 'IPD admissions, occupancy and length of stay report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getFinancialRevenueReport(req, res, next) {
  try {
    const data = await reportService.getFinancialRevenueReport(req.query);
    return sendSuccess(res, data, 'Financial revenue, collections and aging receivables report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getLaboratoryReport(req, res, next) {
  try {
    const data = await reportService.getLaboratoryReport(req.query);
    return sendSuccess(res, data, 'Laboratory diagnostics report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPharmacyReport(req, res, next) {
  try {
    const data = await reportService.getPharmacyReport(req.query);
    return sendSuccess(res, data, 'Pharmacy dispensing and inventory alerts report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDoctorProductivityReport(req, res, next) {
  try {
    const data = await reportService.getDoctorProductivityReport(req.query);
    return sendSuccess(res, data, 'Doctor clinical workload and revenue report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getDepartmentPerformanceReport(req, res, next) {
  try {
    const data = await reportService.getDepartmentPerformanceReport(req.query);
    return sendSuccess(res, data, 'Departmental throughput and revenue performance report retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getExecutiveOverview,
  getPatientRegistrationReport,
  getAppointmentsAndOpdReport,
  getIpdReport,
  getFinancialRevenueReport,
  getLaboratoryReport,
  getPharmacyReport,
  getDoctorProductivityReport,
  getDepartmentPerformanceReport
};
