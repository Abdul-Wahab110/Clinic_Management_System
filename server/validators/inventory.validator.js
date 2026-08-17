const validItemTypes = [
  'medical_supply',
  'surgical_item',
  'equipment',
  'consumable',
  'cleaning_supply',
  'general_inventory'
];

const validAdjustmentTypes = [
  'adjustment_audit',
  'damaged_writeoff',
  'return_to_supplier',
  'department_transfer'
];

function validateCreateInventoryItem(body) {
  const errors = [];

  if (!body.name || body.name.trim().length === 0) {
    errors.push('Item name is required.');
  }

  if (!body.item_code || body.item_code.trim().length === 0) {
    errors.push('Unique item code is required.');
  }

  if (!body.category_id || isNaN(body.category_id) || parseInt(body.category_id, 10) <= 0) {
    errors.push('Valid inventory category ID is required.');
  }

  if (!body.item_type || !validItemTypes.includes(body.item_type)) {
    errors.push(`Item type must be one of: ${validItemTypes.join(', ')}.`);
  }

  if (!body.unit_of_measure || body.unit_of_measure.trim().length === 0) {
    errors.push('Unit of measure is required.');
  }

  if (body.unit_cost === undefined || isNaN(body.unit_cost) || parseFloat(body.unit_cost) < 0) {
    errors.push('A valid non-negative unit cost is required.');
  }

  return errors;
}

function validateCreateSupplier(body) {
  const errors = [];

  if (!body.name || body.name.trim().length === 0) {
    errors.push('Supplier company name is required.');
  }

  if (!body.phone || body.phone.trim().length === 0) {
    errors.push('Supplier contact phone is required.');
  }

  return errors;
}

function validateStockIn(body) {
  const errors = [];

  if (!body.item_id || isNaN(body.item_id) || parseInt(body.item_id, 10) <= 0) {
    errors.push('A valid inventory item ID is required.');
  }

  if (!body.quantity || isNaN(body.quantity) || parseInt(body.quantity, 10) <= 0) {
    errors.push('Stock-in quantity must be at least 1.');
  }

  if (!body.notes || body.notes.trim().length === 0) {
    errors.push('Receiving notes / supplier reference is required.');
  }

  return errors;
}

function validateStockOut(body) {
  const errors = [];

  if (!body.item_id || isNaN(body.item_id) || parseInt(body.item_id, 10) <= 0) {
    errors.push('A valid inventory item ID is required.');
  }

  if (!body.quantity || isNaN(body.quantity) || parseInt(body.quantity, 10) <= 0) {
    errors.push('Stock-out / issuance quantity must be at least 1.');
  }

  if (!body.notes || body.notes.trim().length === 0) {
    errors.push('Issuance purpose / clinical justification is required.');
  }

  return errors;
}

function validateInventoryAdjustment(body) {
  const errors = [];

  if (!body.item_id || isNaN(body.item_id) || parseInt(body.item_id, 10) <= 0) {
    errors.push('A valid inventory item ID is required.');
  }

  if (body.quantity_change === undefined || isNaN(body.quantity_change) || parseInt(body.quantity_change, 10) === 0) {
    errors.push('A non-zero quantity change integer is required.');
  }

  if (!body.reason || body.reason.trim().length === 0) {
    errors.push('Reason / justification for inventory adjustment is required.');
  }

  return errors;
}

function validateCreatePurchaseOrder(body) {
  const errors = [];

  if (!body.supplier_id || isNaN(body.supplier_id) || parseInt(body.supplier_id, 10) <= 0) {
    errors.push('A valid supplier ID is required.');
  }

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('At least one item must be included in the purchase order.');
  } else {
    body.items.forEach((item, idx) => {
      if (!item.item_id || isNaN(item.item_id)) {
        errors.push(`Item #${idx + 1}: Valid item ID is required.`);
      }
      if (!item.quantity_ordered || isNaN(item.quantity_ordered) || parseInt(item.quantity_ordered, 10) <= 0) {
        errors.push(`Item #${idx + 1}: Quantity ordered must be at least 1.`);
      }
    });
  }

  return errors;
}

module.exports = {
  validateCreateInventoryItem,
  validateCreateSupplier,
  validateStockIn,
  validateStockOut,
  validateInventoryAdjustment,
  validateCreatePurchaseOrder
};
