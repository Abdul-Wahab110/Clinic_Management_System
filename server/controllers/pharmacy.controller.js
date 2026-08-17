const pharmacyService = require('../services/pharmacy.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listCategories(req, res, next) {
  try {
    const categories = await pharmacyService.listCategories();
    return sendSuccess(res, categories, 'Pharmacy categories retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listMedicines(req, res, next) {
  try {
    const result = await pharmacyService.listMedicines(req.query);
    return sendSuccess(res, result.medicines, 'Medicine catalog retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getMedicineById(req, res, next) {
  try {
    const medicine = await pharmacyService.getMedicineById(req.params.id);
    return sendSuccess(res, medicine, 'Medicine details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createMedicine(req, res, next) {
  try {
    const result = await pharmacyService.createMedicine(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateMedicine(req, res, next) {
  try {
    const result = await pharmacyService.updateMedicine(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function adjustStock(req, res, next) {
  try {
    const result = await pharmacyService.adjustStock(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getStockAlerts(req, res, next) {
  try {
    const alerts = await pharmacyService.getStockAlerts();
    return sendSuccess(res, alerts, 'Pharmacy stock alerts retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function dispensePrescription(req, res, next) {
  try {
    const result = await pharmacyService.dispensePrescription(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processPosSale(req, res, next) {
  try {
    const result = await pharmacyService.processPosSale(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processReturn(req, res, next) {
  try {
    const result = await pharmacyService.processReturn(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listSales(req, res, next) {
  try {
    const result = await pharmacyService.listSales(req.query);
    return sendSuccess(res, result.sales, 'Pharmacy sales retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getSaleById(req, res, next) {
  try {
    const sale = await pharmacyService.getSaleById(req.params.id);
    return sendSuccess(res, sale, 'Pharmacy invoice details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listAdjustments(req, res, next) {
  try {
    const adjustments = await pharmacyService.listAdjustments(req.query);
    return sendSuccess(res, adjustments, 'Stock adjustments audit ledger retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPharmacyStats(req, res, next) {
  try {
    const stats = await pharmacyService.getPharmacyStats();
    return sendSuccess(res, stats, 'Pharmacy statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  listMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  adjustStock,
  getStockAlerts,
  dispensePrescription,
  processPosSale,
  processReturn,
  listSales,
  getSaleById,
  listAdjustments,
  getPharmacyStats
};
