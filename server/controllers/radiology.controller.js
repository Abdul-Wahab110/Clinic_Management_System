const radiologyService = require('../services/radiology.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listModalities(req, res, next) {
  try {
    const modalities = await radiologyService.listModalities();
    return sendSuccess(res, modalities, 'Radiology modalities retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listServices(req, res, next) {
  try {
    const services = await radiologyService.listServices(req.query);
    return sendSuccess(res, services, 'Radiology services catalog retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getServiceById(req, res, next) {
  try {
    const service = await radiologyService.getServiceById(req.params.id);
    return sendSuccess(res, service, 'Radiology service details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createService(req, res, next) {
  try {
    const result = await radiologyService.createService(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const result = await radiologyService.updateService(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listOrders(req, res, next) {
  try {
    const result = await radiologyService.listOrders(req.query, req.user);
    return sendSuccess(res, result.orders, 'Radiology imaging requisitions retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getOrderById(req, res, next) {
  try {
    const order = await radiologyService.getOrderById(req.params.id, req.user);
    return sendSuccess(res, order, 'Radiology report details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createOrder(req, res, next) {
  try {
    const result = await radiologyService.createOrder(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function scheduleOrder(req, res, next) {
  try {
    const result = await radiologyService.scheduleOrder(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const result = await radiologyService.updateOrderStatus(req.params.id, req.body.status, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function saveReport(req, res, next) {
  try {
    const result = await radiologyService.saveReport(req.params.id, req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function verifyReport(req, res, next) {
  try {
    const result = await radiologyService.verifyReport(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function getRadiologyStats(req, res, next) {
  try {
    const stats = await radiologyService.getRadiologyStats(req.user);
    return sendSuccess(res, stats, 'Radiology statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listModalities,
  listServices,
  getServiceById,
  createService,
  updateService,
  listOrders,
  getOrderById,
  createOrder,
  scheduleOrder,
  updateOrderStatus,
  saveReport,
  verifyReport,
  getRadiologyStats
};
