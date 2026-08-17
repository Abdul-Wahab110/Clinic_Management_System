const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError, ConflictError } = require('../utils/errors');

/**
 * List Radiology Modalities
 */
async function listModalities() {
  const [rows] = await db.query(
    `SELECT 
      rm.*,
      (SELECT COUNT(*) FROM radiology_services WHERE modality_id = rm.id AND is_active = 1) as services_count
    FROM radiology_modalities rm
    WHERE rm.is_active = 1
    ORDER BY rm.id ASC`
  );
  return rows;
}

/**
 * List Dynamic Radiology Services Catalog with Filtering
 */
async function listServices(query = {}) {
  const { modality_id, modality_code, body_part, search, is_active } = query;
  const conditions = [];
  const params = [];

  if (is_active !== undefined && is_active !== 'all') {
    conditions.push('rs.is_active = ?');
    params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
  } else {
    conditions.push('rs.is_active = 1');
  }

  if (modality_id && modality_id !== 'all') {
    conditions.push('rs.modality_id = ?');
    params.push(parseInt(modality_id, 10));
  }

  if (modality_code && modality_code !== 'all') {
    conditions.push('rm.code = ?');
    params.push(modality_code);
  }

  if (body_part && body_part !== 'all') {
    conditions.push('rs.body_part LIKE ?');
    params.push(`%${body_part}%`);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(rs.name LIKE ? OR rs.code LIKE ? OR rs.body_part LIKE ? OR rs.preparation_instructions LIKE ?)');
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT 
      rs.*,
      rm.name as modality_full_name,
      rm.code as modality_code,
      rm.equipment_room
    FROM radiology_services rs
    JOIN radiology_modalities rm ON rs.modality_id = rm.id
    ${whereClause}
    ORDER BY rs.modality_id ASC, rs.name ASC
  `;

  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * Get Specific Radiology Service by ID
 */
async function getServiceById(id) {
  const [rows] = await db.query(
    `SELECT 
      rs.*,
      rm.name as modality_full_name,
      rm.code as modality_code,
      rm.equipment_room
    FROM radiology_services rs
    JOIN radiology_modalities rm ON rs.modality_id = rm.id
    WHERE rs.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Radiology service not found.');
  return rows[0];
}

/**
 * Create New Dynamic Radiology Service (Admin)
 */
async function createService(data) {
  const [existing] = await db.query('SELECT id FROM radiology_services WHERE code = ?', [data.code.trim()]);
  if (existing.length > 0) throw new ConflictError(`Radiology service with code '${data.code}' already exists.`);

  const [mod] = await db.query('SELECT name FROM radiology_modalities WHERE id = ?', [data.modality_id]);
  if (mod.length === 0) throw new NotFoundError('Selected modality not found.');

  const [res] = await db.query(
    `INSERT INTO radiology_services 
     (modality_id, name, code, modality_name, body_part, contrast_required, fasting_required, duration_minutes, preparation_instructions, price, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.modality_id,
      data.name.trim(),
      data.code.trim().toUpperCase(),
      mod[0].name,
      data.body_part || 'General',
      data.contrast_required ? 1 : 0,
      data.fasting_required ? 1 : 0,
      data.duration_minutes || 30,
      data.preparation_instructions || null,
      parseFloat(data.price) || 0.00,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1
    ]
  );

  return {
    id: res.insertId,
    code: data.code,
    name: data.name,
    message: `Radiology service '${data.name}' created successfully.`
  };
}

/**
 * Update Radiology Service (Admin)
 */
async function updateService(id, data) {
  const [existing] = await db.query('SELECT * FROM radiology_services WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Radiology service not found.');
  const cur = existing[0];

  if (data.code && data.code.trim().toUpperCase() !== cur.code) {
    const [dup] = await db.query('SELECT id FROM radiology_services WHERE code = ? AND id != ?', [data.code.trim().toUpperCase(), id]);
    if (dup.length > 0) throw new ConflictError(`Service code '${data.code}' is already in use.`);
  }

  await db.query(
    `UPDATE radiology_services 
     SET name = ?,
         code = ?,
         modality_id = ?,
         body_part = ?,
         contrast_required = ?,
         fasting_required = ?,
         duration_minutes = ?,
         preparation_instructions = ?,
         price = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.code !== undefined ? data.code.trim().toUpperCase() : cur.code,
      data.modality_id || cur.modality_id,
      data.body_part !== undefined ? data.body_part : cur.body_part,
      data.contrast_required !== undefined ? (data.contrast_required ? 1 : 0) : cur.contrast_required,
      data.fasting_required !== undefined ? (data.fasting_required ? 1 : 0) : cur.fasting_required,
      data.duration_minutes || cur.duration_minutes,
      data.preparation_instructions !== undefined ? data.preparation_instructions : cur.preparation_instructions,
      data.price !== undefined ? parseFloat(data.price) : cur.price,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Radiology service updated successfully.' };
}

/**
 * List Radiology Orders / Procedure Queue with Multi-Criteria Filtering
 */
async function listOrders(filters = {}, actorUser = null) {
  const {
    patient_id,
    doctor_id,
    service_id,
    modality_code,
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
    conditions.push('ro.patient_id = ?');
    params.push(pat[0].id);
  } else if (patient_id) {
    conditions.push('ro.patient_id = ?');
    params.push(patient_id);
  }

  if (doctor_id) {
    conditions.push('ro.doctor_id = ?');
    params.push(doctor_id);
  }

  if (service_id) {
    conditions.push('ro.service_id = ?');
    params.push(service_id);
  }

  if (modality_code && modality_code !== 'all') {
    conditions.push('rm.code = ?');
    params.push(modality_code);
  }

  if (status && status !== 'all') {
    conditions.push('ro.status = ?');
    params.push(status);
  }

  if (priority && priority !== 'all') {
    conditions.push('ro.priority = ?');
    params.push(priority);
  }

  if (date_from) {
    conditions.push('ro.order_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('ro.order_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      ro.order_number LIKE ? OR
      p.first_name LIKE ? OR
      p.last_name LIKE ? OR
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR
      rs.name LIKE ? OR
      u_doc.full_name LIKE ? OR
      ro.clinical_indication LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countSql = `
    SELECT COUNT(*) as total
    FROM radiology_orders ro
    JOIN patients p ON ro.patient_id = p.id
    JOIN doctors doc ON ro.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN radiology_services rs ON ro.service_id = rs.id
    JOIN radiology_modalities rm ON rs.modality_id = rm.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      ro.id,
      ro.order_number,
      ro.patient_id,
      ro.doctor_id,
      ro.service_id,
      ro.record_id,
      ro.appointment_id,
      ro.opd_queue_id,
      ro.order_date,
      ro.priority,
      ro.clinical_indication,
      ro.scheduled_date,
      ro.scheduled_time,
      ro.room_number,
      ro.technician_name,
      ro.status,
      ro.is_critical_finding,
      ro.procedure_started_at,
      ro.procedure_completed_at,
      ro.verified_at,
      ro.price,
      ro.pacs_image_url,
      ro.impression,
      ro.created_at,
      ro.updated_at,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.phone as patient_phone,
      p.allergies as patient_allergies,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      rs.name as service_name,
      rs.code as service_code,
      rs.body_part,
      rs.contrast_required,
      rs.duration_minutes,
      rm.name as modality_name,
      rm.code as modality_code
    FROM radiology_orders ro
    JOIN patients p ON ro.patient_id = p.id
    JOIN doctors doc ON ro.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    JOIN radiology_services rs ON ro.service_id = rs.id
    JOIN radiology_modalities rm ON rs.modality_id = rm.id
    ${whereClause}
    ORDER BY ro.order_date DESC, ro.id DESC
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
 * Get Specific Radiology Order & Diagnostic Report File by ID
 */
async function getOrderById(id, actorUser = null) {
  const [rows] = await db.query(
    `SELECT 
      ro.*,
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
      rs.name as service_name,
      rs.code as service_code,
      rs.body_part,
      rs.contrast_required,
      rs.fasting_required,
      rs.duration_minutes,
      rs.preparation_instructions,
      rm.name as modality_name,
      rm.code as modality_code,
      rm.equipment_room,
      u_ver.full_name as verified_by_name
    FROM radiology_orders ro
    JOIN patients p ON ro.patient_id = p.id
    JOIN doctors doc ON ro.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    JOIN radiology_services rs ON ro.service_id = rs.id
    JOIN radiology_modalities rm ON rs.modality_id = rm.id
    LEFT JOIN users u_ver ON ro.verified_by = u_ver.id
    WHERE ro.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Radiology order not found.');
  const order = rows[0];

  // Access check
  if (actorUser && actorUser.role === 'patient' && order.patient_user_id !== actorUser.id) {
    throw new ForbiddenError('Access to this radiology report is restricted.');
  }

  // Calculate age
  let age = null;
  if (order.patient_dob) {
    const dob = new Date(order.patient_dob);
    age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  }

  return {
    ...order,
    patient_age: age
  };
}

/**
 * Create New Radiology Imaging Requisition
 */
async function createOrder(data, actorUser = null) {
  // 1. Resolve Doctor ID
  let doctorId = data.doctor_id || null;
  if (!doctorId && actorUser && actorUser.role === 'doctor') {
    const [doc] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [actorUser.id]);
    if (doc.length > 0) doctorId = doc[0].id;
  }
  if (!doctorId) {
    const [firstDoc] = await db.query('SELECT id FROM doctors LIMIT 1');
    if (firstDoc.length > 0) doctorId = firstDoc[0].id;
  }
  if (!doctorId) throw new NotFoundError('Doctor record not found.');

  const patientId = parseInt(data.patient_id, 10);
  const [pat] = await db.query('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (pat.length === 0) throw new NotFoundError('Patient not found.');

  const serviceId = parseInt(data.service_id, 10);
  const [svc] = await db.query('SELECT rs.*, rm.equipment_room FROM radiology_services rs JOIN radiology_modalities rm ON rs.modality_id = rm.id WHERE rs.id = ?', [serviceId]);
  if (svc.length === 0) throw new NotFoundError('Selected radiology service not found.');

  const orderNumber = `RAD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
  const orderDate = data.order_date || new Date().toISOString().split('T')[0];
  const priority = data.priority || 'routine';
  const roomNumber = data.room_number || svc[0].equipment_room || 'Radiology Bay 1';

  const [orderRes] = await db.query(
    `INSERT INTO radiology_orders 
     (order_number, patient_id, doctor_id, service_id, record_id, appointment_id, opd_queue_id, order_date, priority, clinical_indication, scheduled_date, scheduled_time, room_number, status, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderNumber,
      patientId,
      doctorId,
      serviceId,
      data.record_id || null,
      data.appointment_id || null,
      data.opd_queue_id || null,
      orderDate,
      priority,
      data.clinical_indication.trim(),
      data.scheduled_date || null,
      data.scheduled_time || null,
      roomNumber,
      data.scheduled_date ? 'scheduled' : 'ordered',
      parseFloat(svc[0].price || 0)
    ]
  );

  return {
    id: orderRes.insertId,
    order_number: orderNumber,
    status: data.scheduled_date ? 'scheduled' : 'ordered',
    price: svc[0].price,
    service_name: svc[0].name,
    message: `Radiology requisition ${orderNumber} created for ${svc[0].name}.`
  };
}

/**
 * Schedule Radiology Procedure
 */
async function scheduleOrder(id, scheduleData, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM radiology_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Radiology order not found.');
  const order = existing[0];

  await db.query(
    `UPDATE radiology_orders 
     SET scheduled_date = ?, 
         scheduled_time = ?, 
         room_number = ?, 
         technician_name = ?, 
         status = 'scheduled' 
     WHERE id = ?`,
    [
      scheduleData.scheduled_date,
      scheduleData.scheduled_time,
      scheduleData.room_number || order.room_number,
      scheduleData.technician_name || order.technician_name,
      id
    ]
  );

  return {
    id,
    order_number: order.order_number,
    status: 'scheduled',
    message: `Procedure for order ${order.order_number} scheduled on ${scheduleData.scheduled_date} at ${scheduleData.scheduled_time}.`
  };
}

/**
 * Update Radiology Order Workflow Status
 */
async function updateOrderStatus(id, status, meta = {}, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM radiology_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Radiology order not found.');
  const order = existing[0];

  const updates = ['status = ?'];
  const params = [status];

  if (status === 'in_progress') {
    updates.push('procedure_started_at = NOW()');
  } else if (status === 'completed') {
    updates.push('procedure_completed_at = NOW()');
  } else if (status === 'verified') {
    updates.push('verified_at = NOW()');
    if (actorUser) {
      updates.push('verified_by = ?');
      params.push(actorUser.id);
    }
  }

  if (meta.technician_name) {
    updates.push('technician_name = ?');
    params.push(meta.technician_name);
  }

  params.push(id);
  await db.query(`UPDATE radiology_orders SET ${updates.join(', ')} WHERE id = ?`, params);

  return {
    id,
    order_number: order.order_number,
    status,
    message: `Order ${order.order_number} status updated to ${status.replace('_', ' ')}.`
  };
}

/**
 * Save Diagnostic Radiology Findings & Impression Report
 */
async function saveReport(id, reportData, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM radiology_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Radiology order not found.');
  const order = existing[0];

  const isVerified = reportData.status === 'verified';

  await db.query(
    `UPDATE radiology_orders 
     SET findings = ?, 
         impression = ?, 
         recommendations = ?, 
         radiation_dose = ?, 
         contrast_details = ?, 
         pacs_image_url = ?, 
         is_critical_finding = ?, 
         status = ?, 
         procedure_completed_at = IF(procedure_completed_at IS NULL, NOW(), procedure_completed_at),
         verified_at = ?, 
         verified_by = ? 
     WHERE id = ?`,
    [
      reportData.findings.trim(),
      reportData.impression.trim(),
      reportData.recommendations ? reportData.recommendations.trim() : null,
      reportData.radiation_dose || null,
      reportData.contrast_details || null,
      reportData.pacs_image_url || null,
      reportData.is_critical_finding ? 1 : 0,
      isVerified ? 'verified' : (reportData.status || 'completed'),
      isVerified ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null,
      isVerified && actorUser ? actorUser.id : null,
      id
    ]
  );

  return {
    id,
    order_number: order.order_number,
    status: isVerified ? 'verified' : 'completed',
    message: isVerified 
      ? `Radiology report for ${order.order_number} verified and released to patient chart.` 
      : `Diagnostic findings for ${order.order_number} saved.`
  };
}

/**
 * Verify Diagnostic Radiology Report
 */
async function verifyReport(id, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM radiology_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Radiology order not found.');
  const order = existing[0];

  await db.query(
    `UPDATE radiology_orders 
     SET status = 'verified', verified_at = NOW(), verified_by = ? 
     WHERE id = ?`,
    [actorUser ? actorUser.id : null, id]
  );

  return {
    id,
    order_number: order.order_number,
    status: 'verified',
    message: `Radiology report ${order.order_number} verified and released.`
  };
}

/**
 * Radiology Statistics & KPIs
 */
async function getRadiologyStats(actorUser = null) {
  const [rows] = await db.query(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'ordered' THEN 1 ELSE 0 END) as ordered_count,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status IN ('completed', 'verified') THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count,
      (SELECT COUNT(*) FROM radiology_services WHERE is_active = 1) as active_services_catalog,
      (SELECT COUNT(*) FROM radiology_modalities WHERE is_active = 1) as active_modalities
    FROM radiology_orders
  `);

  return rows[0];
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
