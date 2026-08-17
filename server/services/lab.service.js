const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * List Laboratory Categories
 */
async function listLabCategories() {
  const [rows] = await db.query(
    `SELECT 
      lc.*,
      (SELECT COUNT(*) FROM lab_tests WHERE category_id = lc.id AND is_active = 1) as tests_count
    FROM lab_categories lc
    WHERE lc.is_active = 1
    ORDER BY lc.name ASC`
  );
  return rows;
}

/**
 * List Laboratory Tests Catalog with Dynamic Filtering
 */
async function listLabTests(query = {}) {
  const { category_id, category, search, is_active } = query;
  const conditions = [];
  const params = [];

  if (is_active !== undefined && is_active !== 'all') {
    conditions.push('lt.is_active = ?');
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  } else {
    conditions.push('lt.is_active = 1');
  }

  if (category_id && category_id !== 'all') {
    conditions.push('lt.category_id = ?');
    params.push(parseInt(category_id, 10));
  }

  if (category && category !== 'all') {
    conditions.push('(lt.category = ? OR lc.name = ?)');
    params.push(category, category);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(lt.name LIKE ? OR lt.code LIKE ? OR lt.description LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      lt.*,
      lc.name as category_name,
      lc.code as category_code,
      lc.icon as category_icon
    FROM lab_tests lt
    LEFT JOIN lab_categories lc ON lt.category_id = lc.id
    ${whereClause}
    ORDER BY lt.name ASC
  `;

  const [rows] = await db.query(sql, params);
  return rows.map(r => {
    let parsedParams = [];
    if (r.default_parameters) {
      try { parsedParams = JSON.parse(r.default_parameters); } catch (_) {}
    }
    return { ...r, default_parameters: parsedParams };
  });
}

/**
 * Get Lab Test Details by ID
 */
async function getLabTestById(id) {
  const [rows] = await db.query(
    `SELECT 
      lt.*,
      lc.name as category_name,
      lc.code as category_code
    FROM lab_tests lt
    LEFT JOIN lab_categories lc ON lt.category_id = lc.id
    WHERE lt.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Laboratory test not found.');
  const test = rows[0];
  let parsedParams = [];
  if (test.default_parameters) {
    try { parsedParams = JSON.parse(test.default_parameters); } catch (_) {}
  }
  return { ...test, default_parameters: parsedParams };
}

/**
 * List Laboratory Orders with Multi-Criteria Filtering
 */
async function listLabOrders(filters = {}, actorUser = null) {
  const {
    patient_id,
    doctor_id,
    status,
    priority,
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

  // Patient access control
  if (actorUser && actorUser.role === 'patient') {
    const [pat] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (pat.length === 0) return { orders: [], pagination: { total: 0, page: 1, limit: limitNum, totalPages: 0 } };
    conditions.push('lo.patient_id = ?');
    params.push(pat[0].id);
  } else if (patient_id) {
    conditions.push('lo.patient_id = ?');
    params.push(patient_id);
  }

  if (doctor_id) {
    conditions.push('lo.doctor_id = ?');
    params.push(doctor_id);
  }

  if (status && status !== 'all') {
    conditions.push('lo.status = ?');
    params.push(status);
  }

  if (priority && priority !== 'all') {
    conditions.push('lo.priority = ?');
    params.push(priority);
  }

  if (date_from) {
    conditions.push('lo.order_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('lo.order_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      lo.order_number LIKE ? OR
      p.first_name LIKE ? OR
      p.last_name LIKE ? OR
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR
      u_doc.full_name LIKE ?
    )`);
    params.push(term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countSql = `
    SELECT COUNT(*) as total
    FROM lab_orders lo
    JOIN patients p ON lo.patient_id = p.id
    JOIN doctors doc ON lo.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      lo.id,
      lo.order_number,
      lo.patient_id,
      lo.doctor_id,
      lo.record_id,
      lo.appointment_id,
      lo.opd_queue_id,
      lo.order_date,
      lo.priority,
      lo.clinical_notes,
      lo.sample_type,
      lo.sample_collected_at,
      lo.processing_started_at,
      lo.completed_at,
      lo.verified_at,
      lo.status,
      lo.total_price,
      lo.created_at,
      lo.updated_at,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.phone as patient_phone,
      p.allergies as patient_allergies,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      dept.name as department_name,
      (SELECT COUNT(*) FROM lab_order_items WHERE order_id = lo.id) as items_count,
      (SELECT COUNT(*) FROM lab_results WHERE order_id = lo.id) as results_count
    FROM lab_orders lo
    JOIN patients p ON lo.patient_id = p.id
    JOIN doctors doc ON lo.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    ${whereClause}
    ORDER BY lo.order_date DESC, lo.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    orders: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Specific Lab Order Requisition with Items & Results
 */
async function getLabOrderById(id, actorUser = null) {
  const [rows] = await db.query(
    `SELECT 
      lo.*,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.blood_group as patient_blood_group,
      p.phone as patient_phone,
      p.email as patient_email,
      p.allergies as patient_allergies,
      p.user_id as patient_user_id,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc.license_number as doctor_license,
      dept.name as department_name,
      u_col.full_name as collected_by_name,
      u_ver.full_name as verified_by_name
    FROM lab_orders lo
    JOIN patients p ON lo.patient_id = p.id
    JOIN doctors doc ON lo.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    LEFT JOIN users u_col ON lo.sample_collected_by = u_col.id
    LEFT JOIN users u_ver ON lo.verified_by = u_ver.id
    WHERE lo.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Laboratory order not found.');
  const order = rows[0];

  // Access check
  if (actorUser && actorUser.role === 'patient' && order.patient_user_id !== actorUser.id) {
    throw new ForbiddenError('Access to this laboratory report is restricted.');
  }

  // Calculate age
  let age = null;
  if (order.patient_dob) {
    const dob = new Date(order.patient_dob);
    age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  }

  // Fetch Order Items
  const [items] = await db.query(
    `SELECT 
      loi.*,
      lt.code as test_code,
      lt.turnaround_hours,
      lt.fasting_required,
      lt.default_parameters
    FROM lab_order_items loi
    LEFT JOIN lab_tests lt ON loi.test_id = lt.id
    WHERE loi.order_id = ?
    ORDER BY loi.id ASC`,
    [id]
  );

  // Fetch Results
  const [results] = await db.query(
    `SELECT 
      lr.*,
      loi.test_name
    FROM lab_results lr
    LEFT JOIN lab_order_items loi ON lr.order_item_id = loi.id
    WHERE lr.order_id = ?
    ORDER BY lr.id ASC`,
    [id]
  );

  return {
    ...order,
    patient_age: age,
    items,
    results
  };
}

/**
 * Create New Laboratory Order
 */
async function createLabOrder(data, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    // 1. Resolve Doctor ID
    let doctorId = data.doctor_id || null;
    if (!doctorId && actorUser && actorUser.role === 'doctor') {
      const [doc] = await conn.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
      if (doc.length > 0) doctorId = doc[0].id;
    }
    if (!doctorId) {
      const [firstDoc] = await conn.query('SELECT id FROM doctors LIMIT 1');
      if (firstDoc.length > 0) doctorId = firstDoc[0].id;
    }
    if (!doctorId) throw new NotFoundError('Doctor record not found.');

    const patientId = parseInt(data.patient_id, 10);
    const [pat] = await conn.query('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (pat.length === 0) throw new NotFoundError('Patient not found.');

    const orderNumber = `LAB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const orderDate = data.order_date || new Date().toISOString().split('T')[0];
    const priority = data.priority || 'routine';

    // 2. Resolve Tests to Include
    const testIds = data.test_ids || (data.items ? data.items.map(i => i.test_id) : []);
    if (testIds.length === 0) throw new BadRequestError('At least one lab test must be selected.');

    const [tests] = await conn.query(
      `SELECT lt.*, lc.name as category_name 
       FROM lab_tests lt 
       LEFT JOIN lab_categories lc ON lt.category_id = lc.id 
       WHERE lt.id IN (${testIds.join(',')})`
    );

    if (tests.length === 0) throw new NotFoundError('Selected laboratory tests not found.');

    let totalPrice = 0.00;
    tests.forEach(t => { totalPrice += parseFloat(t.price || 0); });

    const primarySampleType = tests[0].sample_type || 'Venous Blood';

    // 3. Insert Header
    const [orderRes] = await conn.query(
      `INSERT INTO lab_orders 
       (order_number, patient_id, doctor_id, record_id, appointment_id, opd_queue_id, test_id, order_date, priority, clinical_notes, sample_type, status, total_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber,
        patientId,
        doctorId,
        data.record_id || null,
        data.appointment_id || null,
        data.opd_queue_id || null,
        tests[0].id, // fallback for legacy queries
        orderDate,
        priority,
        data.clinical_notes || null,
        primarySampleType,
        'ordered',
        totalPrice
      ]
    );

    const orderId = orderRes.insertId;

    // 4. Insert Line Items
    for (const test of tests) {
      await conn.query(
        `INSERT INTO lab_order_items 
         (order_id, test_id, test_name, category_name, sample_type, price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          test.id,
          test.name,
          test.category_name || test.category || 'General',
          test.sample_type || 'Venous Blood',
          test.price,
          'ordered'
        ]
      );
    }

    return {
      id: orderId,
      order_number: orderNumber,
      status: 'ordered',
      total_price: totalPrice,
      items_count: tests.length,
      message: `Laboratory order ${orderNumber} created successfully.`
    };
  });
}

/**
 * Update Lab Order Workflow Status
 */
async function updateOrderStatus(id, status, meta = {}, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM lab_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Laboratory order not found.');
  const order = existing[0];

  const updates = ['status = ?'];
  const params = [status];

  if (status === 'sample_collected') {
    updates.push('sample_collected_at = NOW()');
    if (actorUser) {
      updates.push('sample_collected_by = ?');
      params.push(actorUser.id);
    }
  } else if (status === 'processing') {
    updates.push('processing_started_at = NOW()');
  } else if (status === 'completed') {
    updates.push('completed_at = NOW()');
    if (actorUser) {
      updates.push('completed_by = ?');
      params.push(actorUser.id);
    }
  } else if (status === 'verified') {
    updates.push('verified_at = NOW()');
    if (actorUser) {
      updates.push('verified_by = ?');
      params.push(actorUser.id);
    }
  }

  if (meta.sample_type) {
    updates.push('sample_type = ?');
    params.push(meta.sample_type);
  }

  params.push(id);
  await db.query(`UPDATE lab_orders SET ${updates.join(', ')} WHERE id = ?`, params);

  // Update order items status too
  await db.query('UPDATE lab_order_items SET status = ? WHERE order_id = ?', [status, id]);

  return {
    id,
    order_number: order.order_number,
    status,
    message: `Laboratory order ${order.order_number} transitioned to ${status.replace('_', ' ')}.`
  };
}

/**
 * Save Multi-Parameter Results for Lab Order
 */
async function saveLabResults(orderId, resultsData, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM lab_orders WHERE id = ? FOR UPDATE', [orderId]);
    if (existing.length === 0) throw new NotFoundError('Laboratory order not found.');
    const order = existing[0];

    const { results, status = 'completed', result_notes } = resultsData;

    // Remove existing results for this order to avoid duplicates on re-entry
    await conn.query('DELETE FROM lab_results WHERE order_id = ?', [orderId]);

    const resultSummaries = [];

    for (const r of results) {
      const [insRes] = await conn.query(
        `INSERT INTO lab_results 
         (order_id, order_item_id, parameter_name, result_value, unit, reference_range, flag, comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          r.order_item_id || null,
          r.parameter_name.trim(),
          r.result_value.toString().trim(),
          r.unit || null,
          r.reference_range || null,
          r.flag || 'normal',
          r.comments || null
        ]
      );
      resultSummaries.push(`${r.parameter_name}: ${r.result_value} ${r.unit || ''}`);
    }

    const summaryText = resultSummaries.slice(0, 5).join(', ');
    const isVerified = status === 'verified';

    // Update Header
    await conn.query(
      `UPDATE lab_orders 
       SET status = ?, 
           result_value = ?, 
           result_notes = ?, 
           completed_at = IF(completed_at IS NULL, NOW(), completed_at),
           completed_by = IF(completed_by IS NULL, ?, completed_by),
           verified_at = ?,
           verified_by = ? 
       WHERE id = ?`,
      [
        status,
        summaryText,
        result_notes || order.result_notes,
        actorUser ? actorUser.id : null,
        isVerified ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
        isVerified && actorUser ? actorUser.id : null,
        orderId
      ]
    );

    await conn.query('UPDATE lab_order_items SET status = ? WHERE order_id = ?', [status, orderId]);

    return {
      order_id: orderId,
      order_number: order.order_number,
      status,
      results_saved: results.length,
      message: `Results entered for order ${order.order_number} (${results.length} parameters saved).`
    };
  });
}

/**
 * Verify and Finalize Lab Results
 */
async function verifyLabResults(orderId, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM lab_orders WHERE id = ?', [orderId]);
  if (existing.length === 0) throw new NotFoundError('Laboratory order not found.');
  const order = existing[0];

  await db.query(
    `UPDATE lab_orders 
     SET status = 'verified', verified_at = NOW(), verified_by = ? 
     WHERE id = ?`,
    [actorUser ? actorUser.id : null, orderId]
  );

  await db.query("UPDATE lab_order_items SET status = 'verified' WHERE order_id = ?", [orderId]);

  return {
    order_id: orderId,
    order_number: order.order_number,
    status: 'verified',
    message: `Laboratory report ${order.order_number} verified and released.`
  };
}

/**
 * Laboratory KPIs & Analytics
 */
async function getLabStats(actorUser = null) {
  const [rows] = await db.query(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) as ordered_count,
      SUM(CASE WHEN status = 'sample_collected' THEN 1 ELSE 0 END) as sample_collected_count,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_count,
      SUM(CASE WHEN status IN ('completed', 'verified') THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
      (SELECT COUNT(*) FROM lab_tests WHERE is_active = 1) as active_tests_catalog,
      (SELECT COUNT(*) FROM lab_results) as total_results_recorded
    FROM lab_orders
  `);

  return rows[0];
}

module.exports = {
  listLabCategories,
  listLabTests,
  getLabTestById,
  listLabOrders,
  getLabOrderById,
  createLabOrder,
  updateOrderStatus,
  saveLabResults,
  verifyLabResults,
  getLabStats
};
