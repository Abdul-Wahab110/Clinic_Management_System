const db = require('../config/db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Helper to update medicine status based on stock level and expiry date
 */
function determineMedicineStatus(stockQty, minStock, expiryDate) {
  if (expiryDate && new Date(expiryDate) < new Date()) {
    return 'expired';
  }
  if (stockQty <= 0) {
    return 'out_of_stock';
  }
  if (stockQty <= minStock) {
    return 'low_stock';
  }
  return 'in_stock';
}

/**
 * List Pharmacy Therapeutic Categories
 */
async function listCategories() {
  const [rows] = await db.query(`
    SELECT 
      pc.*,
      (SELECT COUNT(*) FROM medicines WHERE category = pc.name AND is_active = 1) as medicines_count
    FROM pharmacy_categories pc
    WHERE pc.is_active = 1
    ORDER BY pc.name ASC
  `);
  return rows;
}

/**
 * List Medicines with Multi-Criteria Search & Filtering
 */
async function listMedicines(query = {}) {
  const {
    category,
    status,
    alert_type,
    search,
    page = 1,
    limit = 50
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['m.is_active = 1'];
  const params = [];

  if (category && category !== 'all') {
    conditions.push('m.category = ?');
    params.push(category);
  }

  if (status && status !== 'all') {
    conditions.push('m.status = ?');
    params.push(status);
  }

  if (alert_type === 'low_stock') {
    conditions.push('m.stock_quantity <= m.min_stock_level AND m.stock_quantity > 0');
  } else if (alert_type === 'out_of_stock') {
    conditions.push('m.stock_quantity <= 0');
  } else if (alert_type === 'expiring_soon') {
    conditions.push('m.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)');
  } else if (alert_type === 'expired') {
    conditions.push('m.expiry_date < CURDATE()');
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(m.name LIKE ? OR m.generic_name LIKE ? OR m.manufacturer LIKE ? OR m.batch_number LIKE ? OR m.category LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `SELECT COUNT(*) as total FROM medicines m ${whereClause}`;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      m.*,
      CASE 
        WHEN m.expiry_date < CURDATE() THEN 'expired'
        WHEN m.stock_quantity <= 0 THEN 'out_of_stock'
        WHEN m.stock_quantity <= m.min_stock_level THEN 'low_stock'
        ELSE 'in_stock'
      END as computed_status,
      DATEDIFF(m.expiry_date, CURDATE()) as days_to_expiry
    FROM medicines m
    ${whereClause}
    ORDER BY 
      CASE 
        WHEN m.stock_quantity <= 0 THEN 1
        WHEN m.stock_quantity <= m.min_stock_level THEN 2
        WHEN m.expiry_date < CURDATE() THEN 3
        ELSE 4
      END ASC,
      m.name ASC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    medicines: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Medicine by ID
 */
async function getMedicineById(id) {
  const [rows] = await db.query(
    `SELECT 
      m.*,
      DATEDIFF(m.expiry_date, CURDATE()) as days_to_expiry
    FROM medicines m 
    WHERE m.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Medicine not found.');
  return rows[0];
}

/**
 * Create New Medicine in Catalog
 */
async function createMedicine(data) {
  const stockQty = parseInt(data.stock_quantity || 0, 10);
  const minStock = parseInt(data.min_stock_level || 10, 10);
  const expiry = data.expiry_date || null;
  const status = determineMedicineStatus(stockQty, minStock, expiry);
  const sellingPrice = parseFloat(data.selling_price || data.unit_price || 0.00);
  const purchasePrice = parseFloat(data.purchase_price || (sellingPrice * 0.70));
  const batchNum = data.batch_number || `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const [res] = await db.query(
    `INSERT INTO medicines 
     (name, generic_name, category, form, strength, batch_number, unit_price, purchase_price, selling_price, stock_quantity, min_stock_level, manufacturer, location_shelf, expiry_date, requires_prescription, status, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.name.trim(),
      data.generic_name.trim(),
      data.category.trim(),
      data.form || 'tablet',
      data.strength || '',
      batchNum,
      sellingPrice,
      purchasePrice,
      sellingPrice,
      stockQty,
      minStock,
      data.manufacturer || 'Standard Pharma',
      data.location_shelf || 'Shelf A-1',
      expiry,
      data.requires_prescription !== undefined ? (data.requires_prescription ? 1 : 0) : 1,
      status
    ]
  );

  return {
    id: res.insertId,
    name: data.name,
    batch_number: batchNum,
    stock_quantity: stockQty,
    status,
    message: `Medicine '${data.name}' added to catalog successfully.`
  };
}

/**
 * Update Medicine in Catalog
 */
async function updateMedicine(id, data) {
  const [existing] = await db.query('SELECT * FROM medicines WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Medicine not found.');
  const cur = existing[0];

  const stockQty = data.stock_quantity !== undefined ? parseInt(data.stock_quantity, 10) : cur.stock_quantity;
  const minStock = data.min_stock_level !== undefined ? parseInt(data.min_stock_level, 10) : cur.min_stock_level;
  const expiry = data.expiry_date !== undefined ? data.expiry_date : cur.expiry_date;
  const status = determineMedicineStatus(stockQty, minStock, expiry);
  const sellingPrice = data.selling_price !== undefined ? parseFloat(data.selling_price) : (data.unit_price !== undefined ? parseFloat(data.unit_price) : cur.selling_price);
  const purchasePrice = data.purchase_price !== undefined ? parseFloat(data.purchase_price) : cur.purchase_price;

  await db.query(
    `UPDATE medicines 
     SET name = ?,
         generic_name = ?,
         category = ?,
         form = ?,
         strength = ?,
         batch_number = ?,
         unit_price = ?,
         purchase_price = ?,
         selling_price = ?,
         stock_quantity = ?,
         min_stock_level = ?,
         manufacturer = ?,
         location_shelf = ?,
         expiry_date = ?,
         requires_prescription = ?,
         status = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.generic_name !== undefined ? data.generic_name.trim() : cur.generic_name,
      data.category !== undefined ? data.category.trim() : cur.category,
      data.form !== undefined ? data.form : cur.form,
      data.strength !== undefined ? data.strength : cur.strength,
      data.batch_number !== undefined ? data.batch_number : cur.batch_number,
      sellingPrice,
      purchasePrice,
      sellingPrice,
      stockQty,
      minStock,
      data.manufacturer !== undefined ? data.manufacturer : cur.manufacturer,
      data.location_shelf !== undefined ? data.location_shelf : cur.location_shelf,
      expiry,
      data.requires_prescription !== undefined ? (data.requires_prescription ? 1 : 0) : cur.requires_prescription,
      status,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Medicine updated successfully.' };
}

/**
 * Stock Adjustment with Database Transaction & Negative Stock Prevention
 */
async function adjustStock(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const medicineId = parseInt(data.medicine_id, 10);
    const qtyChange = parseInt(data.quantity_change, 10);

    const [rows] = await connection.query('SELECT * FROM medicines WHERE id = ? FOR UPDATE', [medicineId]);
    if (rows.length === 0) {
      throw new NotFoundError('Medicine not found.');
    }
    const med = rows[0];

    const stockBefore = med.stock_quantity;
    const stockAfter = stockBefore + qtyChange;

    // Strict Negative Stock Check
    if (stockAfter < 0) {
      throw new BadRequestError(
        `Insufficient stock for '${med.name}'. Current stock is ${stockBefore}, requested reduction is ${Math.abs(qtyChange)}.`
      );
    }

    const newStatus = determineMedicineStatus(stockAfter, med.min_stock_level, med.expiry_date);

    // 1. Update medicine stock
    await connection.query(
      'UPDATE medicines SET stock_quantity = ?, status = ? WHERE id = ?',
      [stockAfter, newStatus, medicineId]
    );

    // 2. Insert stock audit ledger
    await connection.query(
      `INSERT INTO pharmacy_stock_adjustments 
       (medicine_id, adjustment_type, quantity_change, stock_before, stock_after, batch_number, reason, reference_type, reference_id, performed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        medicineId,
        data.adjustment_type,
        qtyChange,
        stockBefore,
        stockAfter,
        data.batch_number || med.batch_number,
        data.reason.trim(),
        data.reference_type || 'manual_audit',
        data.reference_id || null,
        actorUser ? actorUser.id : 1
      ]
    );

    await connection.commit();

    return {
      medicine_id: medicineId,
      medicine_name: med.name,
      stock_before: stockBefore,
      stock_after: stockAfter,
      adjustment_type: data.adjustment_type,
      status: newStatus,
      message: `Stock for '${med.name}' adjusted from ${stockBefore} to ${stockAfter} (${qtyChange > 0 ? '+' : ''}${qtyChange}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get Comprehensive Pharmacy Alerts (Low Stock, Out of Stock, Expiring, Expired)
 */
async function getStockAlerts() {
  const [lowStock] = await db.query(`
    SELECT id, name, generic_name, category, batch_number, stock_quantity, min_stock_level, location_shelf
    FROM medicines
    WHERE stock_quantity <= min_stock_level AND stock_quantity > 0 AND is_active = 1
    ORDER BY stock_quantity ASC
  `);

  const [outOfStock] = await db.query(`
    SELECT id, name, generic_name, category, batch_number, stock_quantity, min_stock_level, location_shelf
    FROM medicines
    WHERE stock_quantity <= 0 AND is_active = 1
    ORDER BY name ASC
  `);

  const [expiringSoon] = await db.query(`
    SELECT id, name, generic_name, category, batch_number, stock_quantity, expiry_date, DATEDIFF(expiry_date, CURDATE()) as days_left
    FROM medicines
    WHERE expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND is_active = 1
    ORDER BY expiry_date ASC
  `);

  const [expired] = await db.query(`
    SELECT id, name, generic_name, category, batch_number, stock_quantity, expiry_date, DATEDIFF(CURDATE(), expiry_date) as days_expired
    FROM medicines
    WHERE expiry_date < CURDATE() AND is_active = 1
    ORDER BY expiry_date ASC
  `);

  return {
    summary: {
      low_stock_count: lowStock.length,
      out_of_stock_count: outOfStock.length,
      expiring_soon_count: expiringSoon.length,
      expired_count: expired.length,
      total_alerts: lowStock.length + outOfStock.length + expiringSoon.length + expired.length
    },
    low_stock: lowStock,
    out_of_stock: outOfStock,
    expiring_soon: expiringSoon,
    expired: expired
  };
}

/**
 * Dispense Prescription Order with Transaction & Stock Deduction
 */
async function dispensePrescription(dispenseData, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let patientId = dispenseData.patient_id || null;
    let doctorId = dispenseData.doctor_id || null;
    let prescriptionId = dispenseData.prescription_id || null;
    let customerName = dispenseData.customer_name || 'Clinic Patient';
    let customerPhone = dispenseData.customer_phone || null;

    let itemsToDispense = [];

    // If prescription_id provided, fetch prescription line items
    if (prescriptionId) {
      const [rx] = await connection.query(
        `SELECT po.*, p.first_name, p.last_name, p.phone as patient_phone, u_doc.full_name as doctor_name
         FROM prescription_orders po
         LEFT JOIN patients p ON po.patient_id = p.id
         LEFT JOIN doctors doc ON po.doctor_id = doc.id
         LEFT JOIN users u_doc ON doc.user_id = u_doc.id
         WHERE po.id = ? FOR UPDATE`,
        [prescriptionId]
      );

      if (rx.length === 0) throw new NotFoundError('Prescription order not found.');
      const prescription = rx[0];

      patientId = prescription.patient_id;
      doctorId = prescription.doctor_id;
      customerName = `${prescription.first_name || ''} ${prescription.last_name || ''}`.trim() || 'Prescription Patient';
      customerPhone = prescription.patient_phone || null;

      // Fetch items from prescription_items
      const [rxItems] = await connection.query(
        'SELECT * FROM prescription_items WHERE prescription_id = ?',
        [prescriptionId]
      );

      if (rxItems.length > 0) {
        itemsToDispense = rxItems.map(item => ({
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          quantity: item.quantity || 1
        }));
      }
    }

    // Override or supply direct items
    if (dispenseData.items && Array.isArray(dispenseData.items) && dispenseData.items.length > 0) {
      itemsToDispense = dispenseData.items;
    }

    if (itemsToDispense.length === 0) {
      throw new BadRequestError('No medication line items found to dispense.');
    }

    const invoiceNumber = `PHARM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    let subtotal = 0;
    const resolvedSaleItems = [];

    // Process and deduct stock for each medicine
    for (const item of itemsToDispense) {
      let medId = item.medicine_id;
      let medName = item.medicine_name;

      let medRow;
      if (medId) {
        const [m] = await connection.query('SELECT * FROM medicines WHERE id = ? FOR UPDATE', [medId]);
        if (m.length > 0) medRow = m[0];
      } else if (medName) {
        const [m] = await connection.query('SELECT * FROM medicines WHERE name LIKE ? LIMIT 1 FOR UPDATE', [`%${medName}%`]);
        if (m.length > 0) medRow = m[0];
      }

      if (!medRow) {
        // Fallback default medicine if generic
        const [fallback] = await connection.query('SELECT * FROM medicines LIMIT 1 FOR UPDATE');
        medRow = fallback[0];
      }

      const qty = parseInt(item.quantity, 10);
      if (qty <= 0) throw new BadRequestError(`Invalid quantity ${qty} for medicine ${medRow.name}.`);

      // Negative stock safeguard
      if (medRow.stock_quantity < qty) {
        throw new BadRequestError(
          `Insufficient pharmacy stock for '${medRow.name}'. Available: ${medRow.stock_quantity}, Required: ${qty}.`
        );
      }

      const unitPrice = parseFloat(item.unit_price || medRow.selling_price || medRow.unit_price || 0.00);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      const stockBefore = medRow.stock_quantity;
      const stockAfter = stockBefore - qty;
      const newStatus = determineMedicineStatus(stockAfter, medRow.min_stock_level, medRow.expiry_date);

      // Deduct stock in medicines table
      await connection.query(
        'UPDATE medicines SET stock_quantity = ?, status = ? WHERE id = ?',
        [stockAfter, newStatus, medRow.id]
      );

      // Log stock adjustment audit
      await connection.query(
        `INSERT INTO pharmacy_stock_adjustments 
         (medicine_id, adjustment_type, quantity_change, stock_before, stock_after, batch_number, reason, reference_type, reference_id, performed_by)
         VALUES (?, 'dispensed', ?, ?, ?, ?, ?, 'prescription', ?, ?)`,
        [
          medRow.id,
          -qty,
          stockBefore,
          stockAfter,
          medRow.batch_number,
          `Dispensed for Prescription #${prescriptionId || 'Direct'} (${customerName})`,
          prescriptionId,
          actorUser ? actorUser.id : 1
        ]
      );

      resolvedSaleItems.push({
        medicine_id: medRow.id,
        medicine_name: medRow.name,
        generic_name: medRow.generic_name,
        batch_number: medRow.batch_number,
        expiry_date: medRow.expiry_date,
        quantity: qty,
        unit_price: unitPrice,
        total_price: lineTotal
      });
    }

    const discount = parseFloat(dispenseData.discount || 0.00);
    const taxRate = parseFloat(dispenseData.tax_rate || 0.05); // 5% standard
    const taxableAmount = Math.max(0, subtotal - discount);
    const tax = parseFloat((taxableAmount * taxRate).toFixed(2));
    const totalAmount = parseFloat((taxableAmount + tax).toFixed(2));

    const paymentMethod = dispenseData.payment_method || 'cash';
    const paymentStatus = dispenseData.payment_status || 'paid';

    // Insert pharmacy_sales master invoice
    const [saleRes] = await connection.query(
      `INSERT INTO pharmacy_sales 
       (invoice_number, patient_id, prescription_id, doctor_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, status, dispensed_by, dispensed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, NOW(), ?)`,
      [
        invoiceNumber,
        patientId,
        prescriptionId,
        doctorId,
        customerName,
        customerPhone,
        subtotal,
        discount,
        tax,
        totalAmount,
        paymentMethod,
        paymentStatus,
        actorUser ? actorUser.id : 1,
        dispenseData.notes || 'Dispensed from Clinic Pharmacy'
      ]
    );

    const saleId = saleRes.insertId;

    // Insert sale items
    for (const sItem of resolvedSaleItems) {
      await connection.query(
        `INSERT INTO pharmacy_sale_items 
         (sale_id, medicine_id, medicine_name, generic_name, batch_number, expiry_date, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          sItem.medicine_id,
          sItem.medicine_name,
          sItem.generic_name,
          sItem.batch_number,
          sItem.expiry_date,
          sItem.quantity,
          sItem.unit_price,
          sItem.total_price
        ]
      );
    }

    // Update prescription order status to 'dispensed'
    if (prescriptionId) {
      await connection.query(
        "UPDATE prescription_orders SET status = 'dispensed' WHERE id = ?",
        [prescriptionId]
      );
    }

    await connection.commit();

    return {
      sale_id: saleId,
      invoice_number: invoiceNumber,
      customer_name: customerName,
      items_count: resolvedSaleItems.length,
      subtotal,
      total_amount: totalAmount,
      status: 'completed',
      message: `Prescription successfully dispensed. Pharmacy invoice ${invoiceNumber} generated.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Direct POS Pharmacy Sale
 */
async function processPosSale(saleData, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const invoiceNumber = `PHARM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const customerName = saleData.customer_name.trim();
    const customerPhone = saleData.customer_phone ? saleData.customer_phone.trim() : null;

    let subtotal = 0;
    const resolvedSaleItems = [];

    for (const item of saleData.items) {
      const medId = parseInt(item.medicine_id, 10);
      const [m] = await connection.query('SELECT * FROM medicines WHERE id = ? FOR UPDATE', [medId]);
      if (m.length === 0) throw new NotFoundError(`Medicine with ID ${medId} not found.`);
      const med = m[0];

      const qty = parseInt(item.quantity, 10);
      if (qty <= 0) throw new BadRequestError(`Invalid quantity ${qty} for ${med.name}.`);

      if (med.stock_quantity < qty) {
        throw new BadRequestError(`Insufficient stock for '${med.name}'. Current: ${med.stock_quantity}, Requested: ${qty}.`);
      }

      const unitPrice = parseFloat(item.unit_price || med.selling_price || med.unit_price || 0.00);
      const lineTotal = unitPrice * qty;
      subtotal += lineTotal;

      const stockBefore = med.stock_quantity;
      const stockAfter = stockBefore - qty;
      const newStatus = determineMedicineStatus(stockAfter, med.min_stock_level, med.expiry_date);

      await connection.query('UPDATE medicines SET stock_quantity = ?, status = ? WHERE id = ?', [stockAfter, newStatus, med.id]);

      await connection.query(
        `INSERT INTO pharmacy_stock_adjustments 
         (medicine_id, adjustment_type, quantity_change, stock_before, stock_after, batch_number, reason, reference_type, performed_by)
         VALUES (?, 'sold_pos', ?, ?, ?, ?, ?, 'sale', ?)`,
        [
          med.id,
          -qty,
          stockBefore,
          stockAfter,
          med.batch_number,
          `POS Sale to ${customerName}`,
          actorUser ? actorUser.id : 1
        ]
      );

      resolvedSaleItems.push({
        medicine_id: med.id,
        medicine_name: med.name,
        generic_name: med.generic_name,
        batch_number: med.batch_number,
        expiry_date: med.expiry_date,
        quantity: qty,
        unit_price: unitPrice,
        total_price: lineTotal
      });
    }

    const discount = parseFloat(saleData.discount || 0.00);
    const tax = parseFloat(saleData.tax || (Math.max(0, subtotal - discount) * 0.05).toFixed(2));
    const totalAmount = parseFloat((Math.max(0, subtotal - discount) + tax).toFixed(2));

    const [saleRes] = await connection.query(
      `INSERT INTO pharmacy_sales 
       (invoice_number, patient_id, customer_name, customer_phone, subtotal, discount, tax, total_amount, payment_method, payment_status, status, dispensed_by, dispensed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'completed', ?, NOW(), ?)`,
      [
        invoiceNumber,
        saleData.patient_id || null,
        customerName,
        customerPhone,
        subtotal,
        discount,
        tax,
        totalAmount,
        saleData.payment_method || 'cash',
        actorUser ? actorUser.id : 1,
        saleData.notes || 'Point of Sale Pharmacy Receipt'
      ]
    );

    const saleId = saleRes.insertId;

    for (const sItem of resolvedSaleItems) {
      await connection.query(
        `INSERT INTO pharmacy_sale_items 
         (sale_id, medicine_id, medicine_name, generic_name, batch_number, expiry_date, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          sItem.medicine_id,
          sItem.medicine_name,
          sItem.generic_name,
          sItem.batch_number,
          sItem.expiry_date,
          sItem.quantity,
          sItem.unit_price,
          sItem.total_price
        ]
      );
    }

    await connection.commit();

    return {
      sale_id: saleId,
      invoice_number: invoiceNumber,
      customer_name: customerName,
      items_count: resolvedSaleItems.length,
      subtotal,
      total_amount: totalAmount,
      message: `POS Sale completed successfully. Receipt: ${invoiceNumber}`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Pharmacy Return with Restock & Transaction
 */
async function processReturn(returnData, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const saleId = parseInt(returnData.sale_id, 10);
    const saleItemId = parseInt(returnData.sale_item_id, 10);
    const returnQty = parseInt(returnData.quantity_returned, 10);
    const restock = returnData.restock_item !== undefined ? (returnData.restock_item ? 1 : 0) : 1;

    const [saleRows] = await connection.query('SELECT * FROM pharmacy_sales WHERE id = ? FOR UPDATE', [saleId]);
    if (saleRows.length === 0) throw new NotFoundError('Pharmacy sale not found.');
    const sale = saleRows[0];

    const [itemRows] = await connection.query('SELECT * FROM pharmacy_sale_items WHERE id = ? AND sale_id = ? FOR UPDATE', [saleItemId, saleId]);
    if (itemRows.length === 0) throw new NotFoundError('Sale line item not found.');
    const item = itemRows[0];

    const availableToReturn = item.quantity - item.returned_quantity;
    if (returnQty > availableToReturn) {
      throw new BadRequestError(`Cannot return ${returnQty} units. Maximum refundable units for this line item is ${availableToReturn}.`);
    }

    const refundAmount = parseFloat((item.unit_price * returnQty).toFixed(2));
    const returnNumber = `RET-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 1. Insert return record
    await connection.query(
      `INSERT INTO pharmacy_returns 
       (return_number, sale_id, sale_item_id, medicine_id, quantity_returned, refund_amount, reason, restock_item, processed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        returnNumber,
        saleId,
        saleItemId,
        item.medicine_id,
        returnQty,
        refundAmount,
        returnData.reason.trim(),
        restock,
        actorUser ? actorUser.id : 1
      ]
    );

    // 2. Update line item returned_quantity
    const newReturnedQty = item.returned_quantity + returnQty;
    await connection.query(
      'UPDATE pharmacy_sale_items SET returned_quantity = ? WHERE id = ?',
      [newReturnedQty, saleItemId]
    );

    // 3. Restock inventory if item is unopened/safe
    if (restock === 1) {
      const [m] = await connection.query('SELECT * FROM medicines WHERE id = ? FOR UPDATE', [item.medicine_id]);
      if (m.length > 0) {
        const med = m[0];
        const stockBefore = med.stock_quantity;
        const stockAfter = stockBefore + returnQty;
        const newStatus = determineMedicineStatus(stockAfter, med.min_stock_level, med.expiry_date);

        await connection.query('UPDATE medicines SET stock_quantity = ?, status = ? WHERE id = ?', [stockAfter, newStatus, med.id]);

        await connection.query(
          `INSERT INTO pharmacy_stock_adjustments 
           (medicine_id, adjustment_type, quantity_change, stock_before, stock_after, batch_number, reason, reference_type, reference_id, performed_by)
           VALUES (?, 'returned', ?, ?, ?, ?, ?, 'return', ?, ?)`,
          [
            med.id,
            returnQty,
            stockBefore,
            stockAfter,
            med.batch_number,
            `Customer Return: ${returnData.reason.trim()}`,
            saleId,
            actorUser ? actorUser.id : 1
          ]
        );
      }
    }

    // 4. Update overall sale status
    const [allSaleItems] = await connection.query('SELECT quantity, returned_quantity FROM pharmacy_sale_items WHERE sale_id = ?', [saleId]);
    const allReturned = allSaleItems.every(i => i.quantity === i.returned_quantity);
    const saleStatus = allReturned ? 'returned' : 'partially_returned';

    await connection.query('UPDATE pharmacy_sales SET status = ? WHERE id = ?', [saleStatus, saleId]);

    await connection.commit();

    return {
      return_number: returnNumber,
      refund_amount: refundAmount,
      quantity_returned: returnQty,
      restocked: restock === 1,
      sale_status: saleStatus,
      message: `Return ${returnNumber} processed successfully. Refund amount: $${refundAmount.toFixed(2)}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * List Pharmacy Sales with Filtering
 */
async function listSales(filters = {}) {
  const {
    patient_id,
    payment_status,
    status,
    date_from,
    date_to,
    search,
    page = 1,
    limit = 20
  } = filters;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (patient_id) {
    conditions.push('ps.patient_id = ?');
    params.push(patient_id);
  }

  if (payment_status && payment_status !== 'all') {
    conditions.push('ps.payment_status = ?');
    params.push(payment_status);
  }

  if (status && status !== 'all') {
    conditions.push('ps.status = ?');
    params.push(status);
  }

  if (date_from) {
    conditions.push('ps.dispensed_at >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('ps.dispensed_at <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(ps.invoice_number LIKE ? OR ps.customer_name LIKE ? OR ps.customer_phone LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM pharmacy_sales ps ${whereClause}`;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      ps.*,
      p.patient_code,
      u_disp.full_name as dispensed_by_name,
      (SELECT COUNT(*) FROM pharmacy_sale_items WHERE sale_id = ps.id) as items_count
    FROM pharmacy_sales ps
    LEFT JOIN patients p ON ps.patient_id = p.id
    LEFT JOIN users u_disp ON ps.dispensed_by = u_disp.id
    ${whereClause}
    ORDER BY ps.dispensed_at DESC, ps.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    sales: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Specific Pharmacy Sale & Invoice File by ID
 */
async function getSaleById(id) {
  const [rows] = await db.query(
    `SELECT 
      ps.*,
      p.patient_code,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.allergies as patient_allergies,
      u_disp.full_name as dispensed_by_name,
      po.prescription_number,
      u_doc.full_name as doctor_name
    FROM pharmacy_sales ps
    LEFT JOIN patients p ON ps.patient_id = p.id
    LEFT JOIN users u_disp ON ps.dispensed_by = u_disp.id
    LEFT JOIN prescription_orders po ON ps.prescription_id = po.id
    LEFT JOIN doctors doc ON ps.doctor_id = doc.id
    LEFT JOIN users u_doc ON doc.user_id = u_doc.id
    WHERE ps.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Pharmacy sale invoice not found.');
  const sale = rows[0];

  const [items] = await db.query(
    'SELECT * FROM pharmacy_sale_items WHERE sale_id = ? ORDER BY id ASC',
    [id]
  );

  const [returns] = await db.query(
    `SELECT pr.*, u.full_name as processed_by_name 
     FROM pharmacy_returns pr
     LEFT JOIN users u ON pr.processed_by = u.id
     WHERE pr.sale_id = ? ORDER BY pr.id DESC`,
    [id]
  );

  return {
    ...sale,
    items,
    returns
  };
}

/**
 * List Stock Audit Adjustments Ledger
 */
async function listAdjustments(query = {}) {
  const { medicine_id, adjustment_type, limit = 50 } = query;
  const conditions = [];
  const params = [];

  if (medicine_id) {
    conditions.push('psa.medicine_id = ?');
    params.push(parseInt(medicine_id, 10));
  }

  if (adjustment_type && adjustment_type !== 'all') {
    conditions.push('psa.adjustment_type = ?');
    params.push(adjustment_type);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      psa.*,
      m.name as medicine_name,
      m.generic_name,
      m.category,
      u.full_name as performed_by_name
    FROM pharmacy_stock_adjustments psa
    JOIN medicines m ON psa.medicine_id = m.id
    LEFT JOIN users u ON psa.performed_by = u.id
    ${whereClause}
    ORDER BY psa.created_at DESC, psa.id DESC
    LIMIT ?`,
    [...params, parseInt(limit, 10) || 50]
  );

  return rows;
}

/**
 * Pharmacy Statistics & KPIs
 */
async function getPharmacyStats() {
  const [medStats] = await db.query(`
    SELECT 
      COUNT(*) as total_medicines,
      SUM(CASE WHEN stock_quantity <= min_stock_level AND stock_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN stock_quantity <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as expiring_soon_count,
      SUM(CASE WHEN expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_count,
      SUM(stock_quantity * purchase_price) as total_inventory_valuation
    FROM medicines
    WHERE is_active = 1
  `);

  const [salesStats] = await db.query(`
    SELECT 
      COUNT(*) as total_sales_count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      SUM(CASE WHEN DATE(dispensed_at) = CURDATE() THEN 1 ELSE 0 END) as sales_today_count,
      COALESCE(SUM(CASE WHEN DATE(dispensed_at) = CURDATE() THEN total_amount ELSE 0 END), 0) as revenue_today
    FROM pharmacy_sales
    WHERE status != 'cancelled'
  `);

  return {
    ...medStats[0],
    ...salesStats[0]
  };
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
