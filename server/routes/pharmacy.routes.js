const express = require('express');
const router = express.Router();
const pharmacyController = require('../controllers/pharmacy.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  validateCreateMedicine,
  validateStockAdjustment,
  validateDispensePrescription,
  validateProcessSale,
  validateProcessReturn
} = require('../validators/pharmacy.validator');

// 1. Categories
router.get(
  '/categories',
  authenticate,
  pharmacyController.listCategories
);

// 2. Stock Alerts (Low Stock, Out of Stock, Expiring, Expired)
router.get(
  '/alerts',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'pharmacist'),
  pharmacyController.getStockAlerts
);

// 3. Stats & KPIs
router.get(
  '/stats',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'pharmacist'),
  pharmacyController.getPharmacyStats
);

// 4. Medicine Catalog List
router.get(
  '/medicines',
  authenticate,
  pharmacyController.listMedicines
);

// 5. Specific Medicine Details
router.get(
  '/medicines/:id',
  authenticate,
  pharmacyController.getMedicineById
);

// 6. Create Medicine in Catalog (Admin / Staff / Pharmacist)
router.post(
  '/medicines',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'pharmacist'),
  validate(validateCreateMedicine),
  pharmacyController.createMedicine
);

// 7. Update Medicine in Catalog (Admin / Staff / Pharmacist)
router.put(
  '/medicines/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'pharmacist'),
  pharmacyController.updateMedicine
);

// 8. Stock Adjustment (Transaction & Audit Ledger)
router.post(
  '/adjust-stock',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'pharmacist'),
  validate(validateStockAdjustment),
  pharmacyController.adjustStock
);

// 9. Dispense Prescription Order
router.post(
  '/dispense',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'doctor', 'staff', 'pharmacist'),
  validate(validateDispensePrescription),
  pharmacyController.dispensePrescription
);

// 10. Process Direct POS Pharmacy Sale
router.post(
  '/sales',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'doctor', 'pharmacist'),
  validate(validateProcessSale),
  pharmacyController.processPosSale
);

// 11. List Pharmacy Sales Invoices
router.get(
  '/sales',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'doctor', 'pharmacist'),
  pharmacyController.listSales
);

// 12. View Specific Pharmacy Sale Invoice
router.get(
  '/sales/:id',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'doctor', 'pharmacist'),
  pharmacyController.getSaleById
);

// 13. Process Customer / Patient Return
router.post(
  '/returns',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'pharmacist'),
  validate(validateProcessReturn),
  pharmacyController.processReturn
);

// 14. Stock Audit Adjustments Ledger
router.get(
  '/adjustments',
  authenticate,
  authorize('super_admin', 'hospital_admin', 'staff', 'pharmacist'),
  pharmacyController.listAdjustments
);

module.exports = router;
