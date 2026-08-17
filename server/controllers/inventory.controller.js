const inventoryService = require('../services/inventory.service');
const { sendSuccess, sendCreated } = require('../utils/response');

async function listCategories(req, res, next) {
  try {
    const categories = await inventoryService.listCategories();
    return sendSuccess(res, categories, 'Inventory categories retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function listSuppliers(req, res, next) {
  try {
    const suppliers = await inventoryService.listSuppliers(req.query);
    return sendSuccess(res, suppliers, 'Suppliers directory retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createSupplier(req, res, next) {
  try {
    const result = await inventoryService.createSupplier(req.body);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateSupplier(req, res, next) {
  try {
    const result = await inventoryService.updateSupplier(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listItems(req, res, next) {
  try {
    const result = await inventoryService.listItems(req.query);
    return sendSuccess(res, result.items, 'Inventory items retrieved successfully.', 200, result.pagination);
  } catch (error) {
    next(error);
  }
}

async function getItemById(req, res, next) {
  try {
    const item = await inventoryService.getItemById(req.params.id);
    return sendSuccess(res, item, 'Inventory item details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createItem(req, res, next) {
  try {
    const result = await inventoryService.createItem(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const result = await inventoryService.updateItem(req.params.id, req.body);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processStockIn(req, res, next) {
  try {
    const result = await inventoryService.processStockIn(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processStockOut(req, res, next) {
  try {
    const result = await inventoryService.processStockOut(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function processStockAdjustment(req, res, next) {
  try {
    const result = await inventoryService.processStockAdjustment(req.body, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listPurchaseOrders(req, res, next) {
  try {
    const orders = await inventoryService.listPurchaseOrders(req.query);
    return sendSuccess(res, orders, 'Purchase orders retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getPurchaseOrderById(req, res, next) {
  try {
    const order = await inventoryService.getPurchaseOrderById(req.params.id);
    return sendSuccess(res, order, 'Purchase order details retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function createPurchaseOrder(req, res, next) {
  try {
    const result = await inventoryService.createPurchaseOrder(req.body, req.user);
    return sendCreated(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function receivePurchaseOrder(req, res, next) {
  try {
    const result = await inventoryService.receivePurchaseOrder(req.params.id, req.user);
    return sendSuccess(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

async function listTransactions(req, res, next) {
  try {
    const transactions = await inventoryService.listTransactions(req.query);
    return sendSuccess(res, transactions, 'Inventory stock movement transactions retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getInventoryReports(req, res, next) {
  try {
    const reports = await inventoryService.getInventoryReports();
    return sendSuccess(res, reports, 'Hospital inventory reports retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

async function getInventoryStats(req, res, next) {
  try {
    const stats = await inventoryService.getInventoryStats();
    return sendSuccess(res, stats, 'Inventory statistics retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  listSuppliers,
  createSupplier,
  updateSupplier,
  listItems,
  getItemById,
  createItem,
  updateItem,
  processStockIn,
  processStockOut,
  processStockAdjustment,
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  receivePurchaseOrder,
  listTransactions,
  getInventoryReports,
  getInventoryStats
};
