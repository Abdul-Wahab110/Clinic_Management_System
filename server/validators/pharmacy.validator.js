const validAdjustmentTypes = [
  'purchase_received',
  'dispensed',
  'sold_pos',
  'returned',
  'damaged_expired',
  'inventory_audit',
  'correction'
];

function validateCreateMedicine(body) {
  const errors = [];

  if (!body.name || body.name.trim().length === 0) {
    errors.push('Medicine brand/trade name is required.');
  }

  if (!body.generic_name || body.generic_name.trim().length === 0) {
    errors.push('Generic active ingredient name is required.');
  }

  if (!body.category || body.category.trim().length === 0) {
    errors.push('Therapeutic category is required.');
  }

  if (body.selling_price === undefined && body.unit_price === undefined) {
    errors.push('Selling price / unit price is required.');
  }

  if (body.stock_quantity !== undefined && (isNaN(body.stock_quantity) || parseInt(body.stock_quantity, 10) < 0)) {
    errors.push('Initial stock quantity must be a non-negative integer.');
  }

  return errors;
}

function validateStockAdjustment(body) {
  const errors = [];

  if (!body.medicine_id || isNaN(body.medicine_id) || parseInt(body.medicine_id, 10) <= 0) {
    errors.push('A valid medicine ID is required.');
  }

  if (!body.adjustment_type || !validAdjustmentTypes.includes(body.adjustment_type)) {
    errors.push(`Adjustment type must be one of: ${validAdjustmentTypes.join(', ')}.`);
  }

  if (body.quantity_change === undefined || isNaN(body.quantity_change) || parseInt(body.quantity_change, 10) === 0) {
    errors.push('A non-zero quantity change integer is required.');
  }

  if (!body.reason || body.reason.trim().length === 0) {
    errors.push('Audit reason for stock adjustment is required.');
  }

  return errors;
}

function validateDispensePrescription(body) {
  const errors = [];

  if (!body.prescription_id && !body.patient_id && (!body.items || !Array.isArray(body.items) || body.items.length === 0)) {
    errors.push('Either a valid prescription ID or a list of items to dispense is required.');
  }

  if (body.items && Array.isArray(body.items)) {
    body.items.forEach((item, idx) => {
      if (!item.medicine_id || isNaN(item.medicine_id)) {
        errors.push(`Item #${idx + 1}: Valid medicine ID is required.`);
      }
      if (!item.quantity || isNaN(item.quantity) || parseInt(item.quantity, 10) <= 0) {
        errors.push(`Item #${idx + 1}: Quantity must be at least 1.`);
      }
    });
  }

  return errors;
}

function validateProcessSale(body) {
  const errors = [];

  if (!body.customer_name || body.customer_name.trim().length === 0) {
    errors.push('Customer / Patient name is required for pharmacy sale.');
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one medicine line item is required for the sale.');
  } else {
    body.items.forEach((item, idx) => {
      if (!item.medicine_id || isNaN(item.medicine_id)) {
        errors.push(`Item #${idx + 1}: Valid medicine ID is required.`);
      }
      if (!item.quantity || isNaN(item.quantity) || parseInt(item.quantity, 10) <= 0) {
        errors.push(`Item #${idx + 1}: Quantity must be at least 1.`);
      }
    });
  }

  return errors;
}

function validateProcessReturn(body) {
  const errors = [];

  if (!body.sale_id || isNaN(body.sale_id) || parseInt(body.sale_id, 10) <= 0) {
    errors.push('A valid pharmacy sale ID is required.');
  }

  if (!body.sale_item_id || isNaN(body.sale_item_id) || parseInt(body.sale_item_id, 10) <= 0) {
    errors.push('A valid sale line item ID is required.');
  }

  if (!body.quantity_returned || isNaN(body.quantity_returned) || parseInt(body.quantity_returned, 10) <= 0) {
    errors.push('Returned quantity must be at least 1.');
  }

  if (!body.reason || body.reason.trim().length === 0) {
    errors.push('Reason for pharmacy return is required.');
  }

  return errors;
}

module.exports = {
  validateCreateMedicine,
  validateStockAdjustment,
  validateDispensePrescription,
  validateProcessSale,
  validateProcessReturn
};
