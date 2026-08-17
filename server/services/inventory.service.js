const db = require('../config/db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Determine item status from stock levels and expiry date
 */
function determineItemStatus(currentStock, minStock, expiryDate) {
  if (expiryDate && new Date(expiryDate) < new Date()) {
    return 'expired';
  }
  if (currentStock <= 0) {
    return 'out_of_stock';
  }
  if (currentStock <= minStock) {
    return 'low_stock';
  }
  return 'in_stock';
}

/**
 * List Inventory Categories
 */
async function listCategories() {
  const [rows] = await db.query(`
    SELECT 
      ic.*,
      (SELECT COUNT(*) FROM inventory_items WHERE category_id = ic.id AND is_active = 1) as items_count
    FROM inventory_categories ic
    WHERE ic.is_active = 1
    ORDER BY ic.id ASC
  `);
  return rows;
}

/**
 * List Suppliers
 */
async function listSuppliers(query = {}) {
  const { search, status } = query;
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(name LIKE ? OR code LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await db.query(
    `SELECT 
      s.*,
      (SELECT COUNT(*) FROM inventory_items WHERE supplier_id = s.id AND is_active = 1) as supplied_items_count,
      (SELECT COUNT(*) FROM inventory_purchase_orders WHERE supplier_id = s.id) as total_pos_count
    FROM inventory_suppliers s
    ${whereClause}
    ORDER BY s.name ASC`,
    params
  );
  return rows;
}

/**
 * Create Supplier
 */
async function createSupplier(data) {
  const code = data.code ? data.code.trim().toUpperCase() : `SUP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const [existing] = await db.query('SELECT id FROM inventory_suppliers WHERE code = ?', [code]);
  if (existing.length > 0) throw new ConflictError(`Supplier with code '${code}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO inventory_suppliers 
     (name, code, contact_person, phone, email, address, tax_id, payment_terms, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name.trim(),
      code,
      data.contact_person ? data.contact_person.trim() : null,
      data.phone.trim(),
      data.email ? data.email.trim() : null,
      data.address ? data.address.trim() : null,
      data.tax_id ? data.tax_id.trim() : null,
      data.payment_terms || 'Net 30 Days',
      data.status || 'active'
    ]
  );

  return {
    id: res.insertId,
    code,
    name: data.name,
    message: `Supplier '${data.name}' added successfully.`
  };
}

/**
 * Update Supplier
 */
async function updateSupplier(id, data) {
  const [existing] = await db.query('SELECT * FROM inventory_suppliers WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Supplier not found.');
  const cur = existing[0];

  await db.query(
    `UPDATE inventory_suppliers 
     SET name = ?,
         contact_person = ?,
         phone = ?,
         email = ?,
         address = ?,
         tax_id = ?,
         payment_terms = ?,
         status = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.contact_person !== undefined ? data.contact_person.trim() : cur.contact_person,
      data.phone !== undefined ? data.phone.trim() : cur.phone,
      data.email !== undefined ? data.email.trim() : cur.email,
      data.address !== undefined ? data.address.trim() : cur.address,
      data.tax_id !== undefined ? data.tax_id.trim() : cur.tax_id,
      data.payment_terms !== undefined ? data.payment_terms : cur.payment_terms,
      data.status !== undefined ? data.status : cur.status,
      id
    ]
  );

  return { id, message: 'Supplier updated successfully.' };
}

/**
 * List Inventory Items with Multi-Criteria Search & Filtering
 */
async function listItems(query = {}) {
  const {
    category_id,
    item_type,
    status,
    alert_type,
    storage_location,
    search,
    page = 1,
    limit = 50
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['it.is_active = 1'];
  const params = [];

  if (category_id && category_id !== 'all') {
    conditions.push('it.category_id = ?');
    params.push(parseInt(category_id, 10));
  }

  if (item_type && item_type !== 'all') {
    conditions.push('it.item_type = ?');
    params.push(item_type);
  }

  if (status && status !== 'all') {
    conditions.push('it.status = ?');
    params.push(status);
  }

  if (storage_location && storage_location !== 'all') {
    conditions.push('it.storage_location LIKE ?');
    params.push(`%${storage_location}%`);
  }

  if (alert_type === 'low_stock') {
    conditions.push('it.current_stock <= it.min_stock_level AND it.current_stock > 0');
  } else if (alert_type === 'out_of_stock') {
    conditions.push('it.current_stock <= 0');
  } else if (alert_type === 'expiring_soon') {
    conditions.push('it.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)');
  } else if (alert_type === 'expired') {
    conditions.push('it.expiry_date < CURDATE()');
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(it.name LIKE ? OR it.item_code LIKE ? OR it.generic_spec LIKE ? OR it.batch_number LIKE ? OR it.storage_location LIKE ? OR s.name LIKE ?)');
    params.push(term, term, term, term, term, term);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `
    SELECT COUNT(*) as total
    FROM inventory_items it
    LEFT JOIN inventory_categories ic ON it.category_id = ic.id
    LEFT JOIN inventory_suppliers s ON it.supplier_id = s.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      it.*,
      ic.name as category_name,
      ic.code as category_code,
      s.name as supplier_name,
      s.code as supplier_code,
      (it.current_stock * it.unit_cost) as total_valuation,
      DATEDIFF(it.expiry_date, CURDATE()) as days_to_expiry
    FROM inventory_items it
    LEFT JOIN inventory_categories ic ON it.category_id = ic.id
    LEFT JOIN inventory_suppliers s ON it.supplier_id = s.id
    ${whereClause}
    ORDER BY 
      CASE 
        WHEN it.current_stock <= 0 THEN 1
        WHEN it.current_stock <= it.min_stock_level THEN 2
        WHEN it.expiry_date < CURDATE() THEN 3
        ELSE 4
      END ASC,
      it.name ASC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    items: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Item by ID with Recent Transactions
 */
async function getItemById(id) {
  const [rows] = await db.query(
    `SELECT 
      it.*,
      ic.name as category_name,
      ic.code as category_code,
      s.name as supplier_name,
      s.code as supplier_code,
      s.phone as supplier_phone,
      (it.current_stock * it.unit_cost) as total_valuation,
      DATEDIFF(it.expiry_date, CURDATE()) as days_to_expiry
    FROM inventory_items it
    LEFT JOIN inventory_categories ic ON it.category_id = ic.id
    LEFT JOIN inventory_suppliers s ON it.supplier_id = s.id
    WHERE it.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Inventory item not found.');
  const item = rows[0];

  const [txns] = await db.query(
    `SELECT 
      t.*,
      d.name as department_name,
      u.full_name as performed_by_name
    FROM inventory_transactions t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users u ON t.performed_by = u.id
    WHERE t.item_id = ?
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT 20`,
    [id]
  );

  return {
    ...item,
    transactions: txns
  };
}

/**
 * Create New Inventory Item with Initial Transaction
 */
async function createItem(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const code = data.item_code.trim().toUpperCase();
    const [existing] = await connection.query('SELECT id FROM inventory_items WHERE item_code = ?', [code]);
    if (existing.length > 0) throw new ConflictError(`Inventory item with code '${code}' already exists.`);

    const initialStock = parseInt(data.current_stock || 0, 10);
    const minStock = parseInt(data.min_stock_level || 10, 10);
    const maxStock = parseInt(data.max_stock_level || 500, 10);
    const unitCost = parseFloat(data.unit_cost || 0.00);
    const expiry = data.expiry_date || null;
    const batchNumber = data.batch_number || `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const status = determineItemStatus(initialStock, minStock, expiry);

    const [res] = await connection.query(
      `INSERT INTO inventory_items 
       (category_id, supplier_id, item_code, name, generic_spec, item_type, unit_of_measure, current_stock, min_stock_level, max_stock_level, unit_cost, storage_location, model_number, serial_number, batch_number, expiry_date, status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        parseInt(data.category_id, 10),
        data.supplier_id ? parseInt(data.supplier_id, 10) : null,
        code,
        data.name.trim(),
        data.generic_spec ? data.generic_spec.trim() : null,
        data.item_type,
        data.unit_of_measure.trim(),
        initialStock,
        minStock,
        maxStock,
        unitCost,
        data.storage_location || 'Central Supply Room A-1',
        data.model_number || null,
        data.serial_number || null,
        batchNumber,
        expiry,
        status
      ]
    );

    const itemId = res.insertId;

    // MANDATORY AUDIT RULE: Create an inventory transaction for initial stock if > 0
    if (initialStock > 0) {
      const txnNumber = `TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
      await connection.query(
        `INSERT INTO inventory_transactions 
         (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, reference_type, performed_by, notes)
         VALUES (?, ?, 'stock_in_purchase', ?, ?, ?, 0, ?, ?, ?, 'manual_audit', ?, ?)`,
        [
          txnNumber,
          itemId,
          initialStock,
          unitCost,
          parseFloat((initialStock * unitCost).toFixed(2)),
          initialStock,
          batchNumber,
          expiry,
          actorUser ? actorUser.id : 1,
          `Initial catalog inventory intake for ${data.name.trim()}`
        ]
      );
    }

    await connection.commit();

    return {
      id: itemId,
      item_code: code,
      name: data.name,
      current_stock: initialStock,
      status,
      message: `Inventory item '${data.name}' created with initial stock of ${initialStock}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Update Inventory Item Metadata (Non-stock fields)
 */
async function updateItem(id, data) {
  const [existing] = await db.query('SELECT * FROM inventory_items WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Inventory item not found.');
  const cur = existing[0];

  const minStock = data.min_stock_level !== undefined ? parseInt(data.min_stock_level, 10) : cur.min_stock_level;
  const maxStock = data.max_stock_level !== undefined ? parseInt(data.max_stock_level, 10) : cur.max_stock_level;
  const expiry = data.expiry_date !== undefined ? data.expiry_date : cur.expiry_date;
  const unitCost = data.unit_cost !== undefined ? parseFloat(data.unit_cost) : cur.unit_cost;
  const status = determineItemStatus(cur.current_stock, minStock, expiry);

  await db.query(
    `UPDATE inventory_items 
     SET name = ?,
         category_id = ?,
         supplier_id = ?,
         generic_spec = ?,
         item_type = ?,
         unit_of_measure = ?,
         min_stock_level = ?,
         max_stock_level = ?,
         unit_cost = ?,
         storage_location = ?,
         model_number = ?,
         serial_number = ?,
         batch_number = ?,
         expiry_date = ?,
         status = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.category_id || cur.category_id,
      data.supplier_id !== undefined ? (data.supplier_id ? parseInt(data.supplier_id, 10) : null) : cur.supplier_id,
      data.generic_spec !== undefined ? data.generic_spec : cur.generic_spec,
      data.item_type || cur.item_type,
      data.unit_of_measure || cur.unit_of_measure,
      minStock,
      maxStock,
      unitCost,
      data.storage_location !== undefined ? data.storage_location : cur.storage_location,
      data.model_number !== undefined ? data.model_number : cur.model_number,
      data.serial_number !== undefined ? data.serial_number : cur.serial_number,
      data.batch_number !== undefined ? data.batch_number : cur.batch_number,
      expiry,
      status,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Inventory item metadata updated successfully.' };
}

/**
 * Process Stock In (Receipt of Goods) with Mandatory Transaction
 */
async function processStockIn(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const itemId = parseInt(data.item_id, 10);
    const qty = parseInt(data.quantity, 10);
    if (qty <= 0) throw new BadRequestError('Stock-in quantity must be greater than zero.');

    const [rows] = await connection.query('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [itemId]);
    if (rows.length === 0) throw new NotFoundError('Inventory item not found.');
    const item = rows[0];

    const stockBefore = item.current_stock;
    const stockAfter = stockBefore + qty;
    const unitCost = data.unit_cost !== undefined ? parseFloat(data.unit_cost) : item.unit_cost;
    const totalCost = parseFloat((qty * unitCost).toFixed(2));
    const batchNumber = data.batch_number || item.batch_number;
    const expiry = data.expiry_date || item.expiry_date;

    const newStatus = determineItemStatus(stockAfter, item.min_stock_level, expiry);

    // 1. Update item current stock & batch
    await connection.query(
      `UPDATE inventory_items 
       SET current_stock = ?, 
           unit_cost = ?, 
           batch_number = ?, 
           expiry_date = ?, 
           status = ? 
       WHERE id = ?`,
      [stockAfter, unitCost, batchNumber, expiry, newStatus, itemId]
    );

    // 2. Insert mandatory audit transaction
    const txnNumber = `TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await connection.query(
      `INSERT INTO inventory_transactions 
       (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, reference_type, reference_id, performed_by, notes)
       VALUES (?, ?, 'stock_in_purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        txnNumber,
        itemId,
        qty,
        unitCost,
        totalCost,
        stockBefore,
        stockAfter,
        batchNumber,
        expiry,
        data.po_id ? 'purchase_order' : 'manual_audit',
        data.po_id || null,
        actorUser ? actorUser.id : 1,
        data.notes.trim()
      ]
    );

    await connection.commit();

    return {
      transaction_number: txnNumber,
      item_id: itemId,
      item_name: item.name,
      quantity_added: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      status: newStatus,
      message: `Received ${qty} units of '${item.name}'. Current stock is now ${stockAfter}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Stock Out / Departmental Issuance with Negative Stock Check & Mandatory Transaction
 */
async function processStockOut(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const itemId = parseInt(data.item_id, 10);
    const qty = parseInt(data.quantity, 10);
    if (qty <= 0) throw new BadRequestError('Stock-out quantity must be greater than zero.');

    const [rows] = await connection.query('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [itemId]);
    if (rows.length === 0) throw new NotFoundError('Inventory item not found.');
    const item = rows[0];

    const stockBefore = item.current_stock;

    // Strict Negative Stock Check
    if (stockBefore < qty) {
      throw new BadRequestError(
        `Insufficient stock for '${item.name}'. Available: ${stockBefore}, Requested: ${qty}.`
      );
    }

    const stockAfter = stockBefore - qty;
    const totalCost = parseFloat((qty * item.unit_cost).toFixed(2));
    const newStatus = determineItemStatus(stockAfter, item.min_stock_level, item.expiry_date);

    // 1. Update item current stock
    await connection.query(
      'UPDATE inventory_items SET current_stock = ?, status = ? WHERE id = ?',
      [stockAfter, newStatus, itemId]
    );

    // 2. Insert mandatory audit transaction
    const txnNumber = `TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    await connection.query(
      `INSERT INTO inventory_transactions 
       (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, department_id, issued_to_person, reference_type, performed_by, notes)
       VALUES (?, ?, 'stock_out_issuance', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'department_issuance', ?, ?)`,
      [
        txnNumber,
        itemId,
        -qty,
        item.unit_cost,
        totalCost,
        stockBefore,
        stockAfter,
        item.batch_number,
        item.expiry_date,
        data.department_id ? parseInt(data.department_id, 10) : null,
        data.issued_to_person ? data.issued_to_person.trim() : null,
        actorUser ? actorUser.id : 1,
        data.notes.trim()
      ]
    );

    await connection.commit();

    return {
      transaction_number: txnNumber,
      item_id: itemId,
      item_name: item.name,
      quantity_issued: qty,
      stock_before: stockBefore,
      stock_after: stockAfter,
      status: newStatus,
      message: `Issued ${qty} units of '${item.name}'. Remaining stock is ${stockAfter}.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Process Inventory Adjustment / Physical Audit with Mandatory Transaction
 */
async function processStockAdjustment(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const itemId = parseInt(data.item_id, 10);
    const qtyChange = parseInt(data.quantity_change, 10);
    if (qtyChange === 0) throw new BadRequestError('Quantity change cannot be zero.');

    const [rows] = await connection.query('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [itemId]);
    if (rows.length === 0) throw new NotFoundError('Inventory item not found.');
    const item = rows[0];

    const stockBefore = item.current_stock;
    const stockAfter = stockBefore + qtyChange;

    // Strict Negative Stock Check
    if (stockAfter < 0) {
      throw new BadRequestError(
        `Insufficient stock for '${item.name}'. Available: ${stockBefore}, Requested reduction: ${Math.abs(qtyChange)}.`
      );
    }

    const totalCost = parseFloat((Math.abs(qtyChange) * item.unit_cost).toFixed(2));
    const newStatus = determineItemStatus(stockAfter, item.min_stock_level, item.expiry_date);

    // 1. Update item current stock
    await connection.query(
      'UPDATE inventory_items SET current_stock = ?, status = ? WHERE id = ?',
      [stockAfter, newStatus, itemId]
    );

    // 2. Insert mandatory audit transaction
    const txnType = data.adjustment_type || (qtyChange < 0 ? 'damaged_writeoff' : 'adjustment_audit');
    const txnNumber = `TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    await connection.query(
      `INSERT INTO inventory_transactions 
       (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, reference_type, performed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual_audit', ?, ?)`,
      [
        txnNumber,
        itemId,
        txnType,
        qtyChange,
        item.unit_cost,
        totalCost,
        stockBefore,
        stockAfter,
        data.batch_number || item.batch_number,
        item.expiry_date,
        actorUser ? actorUser.id : 1,
        data.reason.trim()
      ]
    );

    await connection.commit();

    return {
      transaction_number: txnNumber,
      item_id: itemId,
      item_name: item.name,
      quantity_change: qtyChange,
      stock_before: stockBefore,
      stock_after: stockAfter,
      status: newStatus,
      message: `Stock for '${item.name}' adjusted from ${stockBefore} to ${stockAfter} (${qtyChange > 0 ? '+' : ''}${qtyChange}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * List Purchase Orders
 */
async function listPurchaseOrders(query = {}) {
  const { supplier_id, status, date_from, date_to, search } = query;
  const conditions = [];
  const params = [];

  if (supplier_id && supplier_id !== 'all') {
    conditions.push('po.supplier_id = ?');
    params.push(parseInt(supplier_id, 10));
  }

  if (status && status !== 'all') {
    conditions.push('po.status = ?');
    params.push(status);
  }

  if (date_from) {
    conditions.push('po.order_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('po.order_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(po.po_number LIKE ? OR s.name LIKE ?)');
    params.push(term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      po.*,
      s.name as supplier_name,
      s.code as supplier_code,
      s.phone as supplier_phone,
      u_cr.full_name as created_by_name,
      u_ap.full_name as approved_by_name,
      (SELECT COUNT(*) FROM inventory_po_items WHERE po_id = po.id) as items_count
    FROM inventory_purchase_orders po
    JOIN inventory_suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u_cr ON po.created_by = u_cr.id
    LEFT JOIN users u_ap ON po.approved_by = u_ap.id
    ${whereClause}
    ORDER BY po.order_date DESC, po.id DESC`,
    params
  );

  return rows;
}

/**
 * Get Purchase Order by ID with Line Items
 */
async function getPurchaseOrderById(id) {
  const [rows] = await db.query(
    `SELECT 
      po.*,
      s.name as supplier_name,
      s.code as supplier_code,
      s.contact_person as supplier_contact,
      s.phone as supplier_phone,
      s.email as supplier_email,
      s.address as supplier_address,
      u_cr.full_name as created_by_name,
      u_ap.full_name as approved_by_name
    FROM inventory_purchase_orders po
    JOIN inventory_suppliers s ON po.supplier_id = s.id
    LEFT JOIN users u_cr ON po.created_by = u_cr.id
    LEFT JOIN users u_ap ON po.approved_by = u_ap.id
    WHERE po.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Purchase order not found.');
  const po = rows[0];

  const [items] = await db.query(
    `SELECT poi.*, it.item_code, it.current_stock
     FROM inventory_po_items poi
     JOIN inventory_items it ON poi.item_id = it.id
     WHERE poi.po_id = ?`,
    [id]
  );

  return {
    ...po,
    items
  };
}

/**
 * Create Purchase Order
 */
async function createPurchaseOrder(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const poNumber = `PO-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const supplierId = parseInt(data.supplier_id, 10);
    const orderDate = data.order_date || new Date().toISOString().split('T')[0];

    let subtotal = 0;
    const resolvedItems = [];

    for (const item of data.items) {
      const [it] = await connection.query('SELECT * FROM inventory_items WHERE id = ?', [item.item_id]);
      if (it.length === 0) throw new NotFoundError(`Item #${item.item_id} not found.`);
      const itemRow = it[0];

      const qty = parseInt(item.quantity_ordered, 10);
      const unitCost = parseFloat(item.unit_cost || itemRow.unit_cost || 0.00);
      const lineTotal = parseFloat((qty * unitCost).toFixed(2));
      subtotal += lineTotal;

      resolvedItems.push({
        item_id: itemRow.id,
        item_name: itemRow.name,
        unit_of_measure: itemRow.unit_of_measure,
        quantity_ordered: qty,
        unit_cost: unitCost,
        total_cost: lineTotal
      });
    }

    const taxAmount = parseFloat((subtotal * 0.05).toFixed(2)); // 5% standard tax
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    const [poRes] = await connection.query(
      `INSERT INTO inventory_purchase_orders 
       (po_number, supplier_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status, created_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`,
      [
        poNumber,
        supplierId,
        orderDate,
        data.expected_delivery_date || null,
        subtotal,
        taxAmount,
        totalAmount,
        actorUser ? actorUser.id : 1,
        data.notes ? data.notes.trim() : 'Hospital Inventory Procurement Order'
      ]
    );

    const poId = poRes.insertId;

    for (const item of resolvedItems) {
      await connection.query(
        `INSERT INTO inventory_po_items 
         (po_id, item_id, item_name, unit_of_measure, quantity_ordered, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          poId,
          item.item_id,
          item.item_name,
          item.unit_of_measure,
          item.quantity_ordered,
          item.unit_cost,
          item.total_cost
        ]
      );
    }

    await connection.commit();

    return {
      id: poId,
      po_number: poNumber,
      total_amount: totalAmount,
      items_count: resolvedItems.length,
      message: `Purchase Order ${poNumber} created and approved.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Receive Purchase Order & Increment Inventory Stock with Mandatory Transactions
 */
async function receivePurchaseOrder(id, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [poRows] = await connection.query('SELECT * FROM inventory_purchase_orders WHERE id = ? FOR UPDATE', [id]);
    if (poRows.length === 0) throw new NotFoundError('Purchase order not found.');
    const po = poRows[0];

    if (po.status === 'received') {
      throw new BadRequestError('Purchase order has already been received.');
    }

    const [poItems] = await connection.query('SELECT * FROM inventory_po_items WHERE po_id = ? FOR UPDATE', [id]);

    for (const pItem of poItems) {
      const [itRows] = await connection.query('SELECT * FROM inventory_items WHERE id = ? FOR UPDATE', [pItem.item_id]);
      if (itRows.length > 0) {
        const item = itRows[0];
        const qtyToReceive = pItem.quantity_ordered - pItem.quantity_received;

        if (qtyToReceive > 0) {
          const stockBefore = item.current_stock;
          const stockAfter = stockBefore + qtyToReceive;
          const newStatus = determineItemStatus(stockAfter, item.min_stock_level, item.expiry_date);

          // 1. Update item stock
          await connection.query(
            'UPDATE inventory_items SET current_stock = ?, status = ? WHERE id = ?',
            [stockAfter, newStatus, item.id]
          );

          // 2. Update PO item quantity_received
          await connection.query(
            'UPDATE inventory_po_items SET quantity_received = quantity_ordered WHERE id = ?',
            [pItem.id]
          );

          // 3. Insert mandatory audit transaction
          const txnNumber = `TXN-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
          await connection.query(
            `INSERT INTO inventory_transactions 
             (transaction_number, item_id, transaction_type, quantity, unit_cost, total_cost, stock_before, stock_after, batch_number, expiry_date, reference_type, reference_id, performed_by, notes)
             VALUES (?, ?, 'stock_in_purchase', ?, ?, ?, ?, ?, ?, ?, 'purchase_order', ?, ?, ?)`,
            [
              txnNumber,
              item.id,
              qtyToReceive,
              pItem.unit_cost,
              pItem.total_cost,
              stockBefore,
              stockAfter,
              item.batch_number,
              item.expiry_date,
              po.id,
              actorUser ? actorUser.id : 1,
              `Goods Received for PO #${po.po_number}`
            ]
          );
        }
      }
    }

    await connection.query(
      "UPDATE inventory_purchase_orders SET status = 'received', received_at = NOW() WHERE id = ?",
      [id]
    );

    await connection.commit();

    return {
      po_id: id,
      po_number: po.po_number,
      status: 'received',
      message: `Purchase Order ${po.po_number} successfully received. Stock updated across ${poItems.length} items.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * List Stock Movement Audit Ledger Transactions
 */
async function listTransactions(query = {}) {
  const { item_id, transaction_type, department_id, date_from, date_to, limit = 50 } = query;
  const conditions = [];
  const params = [];

  if (item_id) {
    conditions.push('t.item_id = ?');
    params.push(parseInt(item_id, 10));
  }

  if (transaction_type && transaction_type !== 'all') {
    conditions.push('t.transaction_type = ?');
    params.push(transaction_type);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('t.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (date_from) {
    conditions.push('t.created_at >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('t.created_at <= ?');
    params.push(date_to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      t.*,
      it.name as item_name,
      it.item_code,
      it.unit_of_measure,
      ic.name as category_name,
      d.name as department_name,
      u.full_name as performed_by_name
    FROM inventory_transactions t
    JOIN inventory_items it ON t.item_id = it.id
    LEFT JOIN inventory_categories ic ON it.category_id = ic.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users u ON t.performed_by = u.id
    ${whereClause}
    ORDER BY t.created_at DESC, t.id DESC
    LIMIT ?`,
    [...params, parseInt(limit, 10) || 50]
  );

  return rows;
}

/**
 * Comprehensive Inventory Reports (Current Stock, Low Stock, Stock Movement, Purchases, Usage)
 */
async function getInventoryReports() {
  // 1. Current Stock & Valuation Breakdown
  const [stockValuation] = await db.query(`
    SELECT 
      ic.name as category_name,
      ic.item_type,
      COUNT(it.id) as total_items,
      SUM(it.current_stock) as total_units,
      SUM(it.current_stock * it.unit_cost) as category_valuation
    FROM inventory_categories ic
    LEFT JOIN inventory_items it ON ic.id = it.category_id AND it.is_active = 1
    GROUP BY ic.id, ic.name, ic.item_type
    ORDER BY category_valuation DESC
  `);

  // 2. Low Stock Reorder Report
  const [lowStockReport] = await db.query(`
    SELECT 
      it.id,
      it.item_code,
      it.name,
      it.unit_of_measure,
      it.current_stock,
      it.min_stock_level,
      it.unit_cost,
      it.storage_location,
      (it.min_stock_level - it.current_stock) as reorder_quantity,
      s.name as supplier_name,
      s.phone as supplier_phone
    FROM inventory_items it
    LEFT JOIN inventory_suppliers s ON it.supplier_id = s.id
    WHERE it.current_stock <= it.min_stock_level AND it.is_active = 1
    ORDER BY it.current_stock ASC
  `);

  // 3. Purchases Summary (Last 30 Days)
  const [purchasesSummary] = await db.query(`
    SELECT 
      s.name as supplier_name,
      COUNT(po.id) as total_orders,
      SUM(po.total_amount) as total_spent,
      SUM(CASE WHEN po.status = 'received' THEN po.total_amount ELSE 0 END) as delivered_value
    FROM inventory_purchase_orders po
    JOIN inventory_suppliers s ON po.supplier_id = s.id
    WHERE po.order_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
    GROUP BY s.id, s.name
    ORDER BY total_spent DESC
  `);

  // 4. Departmental Usage & Consumption
  const [departmentalUsage] = await db.query(`
    SELECT 
      COALESCE(d.name, 'General Ward & Clinical Services') as department_name,
      COUNT(t.id) as issuance_events,
      SUM(ABS(t.quantity)) as total_units_consumed,
      SUM(t.total_cost) as total_consumption_cost
    FROM inventory_transactions t
    LEFT JOIN departments d ON t.department_id = d.id
    WHERE t.transaction_type = 'stock_out_issuance'
    GROUP BY d.id, d.name
    ORDER BY total_consumption_cost DESC
  `);

  return {
    stock_valuation_by_category: stockValuation,
    low_stock_reorder_list: lowStockReport,
    purchases_summary_by_supplier: purchasesSummary,
    departmental_consumption: departmentalUsage
  };
}

/**
 * Hospital Inventory KPIs & Statistics
 */
async function getInventoryStats() {
  const [itemStats] = await db.query(`
    SELECT 
      COUNT(*) as total_items,
      SUM(CASE WHEN current_stock <= min_stock_level AND current_stock > 0 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN current_stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
      SUM(CASE WHEN expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 1 ELSE 0 END) as expiring_soon_count,
      SUM(CASE WHEN expiry_date < CURDATE() THEN 1 ELSE 0 END) as expired_count,
      SUM(current_stock * unit_cost) as total_inventory_valuation
    FROM inventory_items
    WHERE is_active = 1
  `);

  const [poStats] = await db.query(`
    SELECT 
      COUNT(*) as total_pos,
      SUM(CASE WHEN status IN ('draft', 'submitted', 'approved') THEN 1 ELSE 0 END) as pending_pos,
      COALESCE(SUM(total_amount), 0) as total_po_expenditure
    FROM inventory_purchase_orders
  `);

  const [txnStats] = await db.query(`
    SELECT 
      COUNT(*) as total_transactions,
      SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as transactions_today
    FROM inventory_transactions
  `);

  return {
    ...itemStats[0],
    ...poStats[0],
    ...txnStats[0]
  };
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
