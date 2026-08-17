const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventory.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateInventoryItem,
  validateCreateSupplier,
  validateStockIn,
  validateStockOut,
  validateInventoryAdjustment,
  validateCreatePurchaseOrder
} = require('../validators/inventory.validator');

// 1. Categories
router.get(
  '/categories',
  authenticate,
  inventoryController.listCategories
);

// 2. Stats & KPIs
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.getInventoryStats
);

// 3. Reports (Current stock, low stock, stock movement, purchases, usage)
router.get(
  '/reports',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.getInventoryReports
);

// 4. Suppliers Directory
router.get(
  '/suppliers',
  authenticate,
  inventoryController.listSuppliers
);

router.post(
  '/suppliers',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  validate(validateCreateSupplier),
  inventoryController.createSupplier
);

router.put(
  '/suppliers/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.updateSupplier
);

// 5. Items Catalog
router.get(
  '/items',
  authenticate,
  inventoryController.listItems
);

router.get(
  '/items/:id',
  authenticate,
  inventoryController.getItemById
);

router.post(
  '/items',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  validate(validateCreateInventoryItem),
  inventoryController.createItem
);

router.put(
  '/items/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.updateItem
);

// 6. Stock In (Receipt of Goods)
router.post(
  '/stock-in',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  validate(validateStockIn),
  inventoryController.processStockIn
);

// 7. Stock Out (Departmental Issuance)
router.post(
  '/stock-out',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'doctor'),
  validate(validateStockOut),
  inventoryController.processStockOut
);

// 8. Stock Adjustment (Physical Audit / Damaged Writeoff)
router.post(
  '/adjust-stock',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  validate(validateInventoryAdjustment),
  inventoryController.processStockAdjustment
);

// 9. Purchase Orders
router.get(
  '/purchase-orders',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.listPurchaseOrders
);

router.get(
  '/purchase-orders/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.getPurchaseOrderById
);

router.post(
  '/purchase-orders',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  validate(validateCreatePurchaseOrder),
  inventoryController.createPurchaseOrder
);

router.patch(
  '/purchase-orders/:id/receive',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.receivePurchaseOrder
);

// 10. Master Stock Movement Audit Ledger
router.get(
  '/transactions',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff'),
  inventoryController.listTransactions
);

module.exports = router;
