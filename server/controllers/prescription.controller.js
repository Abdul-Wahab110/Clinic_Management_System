const prescriptionService = require('../services/prescription.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listMedicines(req, res, next) {
  try {
    const medicines = await prescriptionService.listMedicines(req.query);
    return sendSuccess(res, medicines, 'Medicines formulary retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listPrescriptions(req, res, next) {
  try {
    const result = await prescriptionService.listPrescriptions(req.query, req.user);
    return sendSuccess(res, result.prescriptions, 'Prescriptions retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getPrescriptionStats(req, res, next) {
  try {
    const stats = await prescriptionService.getPrescriptionStats(req.user);
    return sendSuccess(res, stats, 'Prescription statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPrescriptionById(req, res, next) {
  try {
    const prescription = await prescriptionService.getPrescriptionById(req.params.id, req.user);
    return sendSuccess(res, prescription, 'Prescription details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createPrescription(req, res, next) {
  try {
    const result = await prescriptionService.createPrescription(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updatePrescription(req, res, next) {
  try {
    const result = await prescriptionService.updatePrescription(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function finalizePrescription(req, res, next) {
  try {
    const result = await prescriptionService.finalizePrescription(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function dispensePrescription(req, res, next) {
  try {
    const result = await prescriptionService.dispensePrescription(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listMedicines,
  listPrescriptions,
  getPrescriptionStats,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  finalizePrescription,
  dispensePrescription
};
