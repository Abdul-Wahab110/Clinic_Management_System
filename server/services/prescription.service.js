const db = require('../config/db');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Get Dynamic Medicines Formulary from MySQL
 */
async function listMedicines(query = {}) {
  const { search, category, form, status = 'in_stock' } = query;
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  if (category && category !== 'all') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (form && form !== 'all') {
    conditions.push('form = ?');
    params.push(form);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(name LIKE ? OR generic_name LIKE ? OR category LIKE ?)');
    params.push(term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM medicines ${whereClause} ORDER BY name ASC`;

  const [rows] = await db.query(sql, params);
  return rows;
}

/**
 * List Prescription Orders with Filtering & History
 */
async function listPrescriptions(filters = {}, actorUser = null) {
  const {
    patient_id,
    doctor_id,
    status,
    search,
    date_from,
    date_to,
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
    if (pat.length === 0) return { prescriptions: [], pagination: { total: 0, page: 1, limit: limitNum, totalPages: 0 } };
    conditions.push('po.patient_id = ?');
    params.push(pat[0].id);
  } else if (patient_id) {
    conditions.push('po.patient_id = ?');
    params.push(patient_id);
  }

  if (doctor_id) {
    conditions.push('po.doctor_id = ?');
    params.push(doctor_id);
  }

  if (status && status !== 'all') {
    conditions.push('po.status = ?');
    params.push(status);
  }

  if (date_from) {
    conditions.push('po.prescription_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('po.prescription_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      po.prescription_number LIKE ? OR
      p.first_name LIKE ? OR
      p.last_name LIKE ? OR
      CONCAT(p.first_name, ' ', p.last_name) LIKE ? OR
      p.patient_code LIKE ? OR
      u_doc.full_name LIKE ? OR
      po.diagnosis LIKE ?
    )`);
    params.push(term, term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countSql = `
    SELECT COUNT(*) as total
    FROM prescription_orders po
    JOIN patients p ON po.patient_id = p.id
    JOIN doctors doc ON po.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      po.id,
      po.prescription_number,
      po.patient_id,
      po.doctor_id,
      po.record_id,
      po.appointment_id,
      po.opd_queue_id,
      po.prescription_date,
      po.status,
      po.diagnosis,
      po.doctor_notes,
      po.patient_advice,
      po.is_locked,
      po.finalized_at,
      po.dispensed_at,
      po.created_at,
      po.updated_at,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.phone as patient_phone,
      p.allergies as patient_allergies,
      u_doc.full_name as doctor_name,
      doc.doctor_code,
      doc.specialization as doctor_specialization,
      dept.name as department_name,
      (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = po.id) as items_count
    FROM prescription_orders po
    JOIN patients p ON po.patient_id = p.id
    JOIN doctors doc ON po.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    ${whereClause}
    ORDER BY po.prescription_date DESC, po.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    prescriptions: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Specific Detailed Prescription File with Line Items
 */
async function getPrescriptionById(id, actorUser = null) {
  const [rows] = await db.query(
    `SELECT 
      po.*,
      p.patient_code,
      CONCAT(p.first_name, ' ', p.last_name) as patient_name,
      p.gender as patient_gender,
      p.date_of_birth as patient_dob,
      p.blood_group as patient_blood_group,
      p.phone as patient_phone,
      p.email as patient_email,
      p.address as patient_address,
      p.allergies as patient_allergies,
      p.user_id as patient_user_id,
      doc.doctor_code,
      u_doc.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc.license_number as doctor_license,
      doc.room_number as doctor_room,
      dept.name as department_name,
      dept.code as department_code
    FROM prescription_orders po
    JOIN patients p ON po.patient_id = p.id
    JOIN doctors doc ON po.doctor_id = doc.id
    JOIN users u_doc ON doc.user_id = u_doc.id
    LEFT JOIN departments dept ON doc.department_id = dept.id
    WHERE po.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Prescription order not found.');
  const prescription = rows[0];

  // Access check
  if (actorUser && actorUser.role === 'patient' && prescription.patient_user_id !== actorUser.id) {
    throw new ForbiddenError('Access to this prescription record is restricted.');
  }

  // Calculate age
  let age = null;
  if (prescription.patient_dob) {
    const dob = new Date(prescription.patient_dob);
    age = Math.abs(new Date(Date.now() - dob.getTime()).getUTCFullYear() - 1970);
  }

  // Fetch Items
  const [items] = await db.query(
    `SELECT 
      pi.*,
      m.form as medicine_form,
      m.strength as medicine_strength,
      m.stock_quantity as current_stock
    FROM prescription_items pi
    LEFT JOIN medicines m ON pi.medicine_id = m.id
    WHERE pi.prescription_id = ?
    ORDER BY pi.id ASC`,
    [id]
  );

  return {
    ...prescription,
    patient_age: age,
    items
  };
}

/**
 * Create New Multi-Medicine Prescription Order (Draft or Finalized)
 */
async function createPrescription(data, actorUser = null) {
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

    const prescriptionNumber = `RX-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const prescriptionDate = data.prescription_date || new Date().toISOString().split('T')[0];
    const isFinal = data.status === 'finalized';

    // 2. Insert Header
    const [orderRes] = await conn.query(
      `INSERT INTO prescription_orders 
       (prescription_number, patient_id, doctor_id, record_id, appointment_id, opd_queue_id, prescription_date, status, diagnosis, doctor_notes, patient_advice, is_locked, finalized_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prescriptionNumber,
        patientId,
        doctorId,
        data.record_id || null,
        data.appointment_id || null,
        data.opd_queue_id || null,
        prescriptionDate,
        isFinal ? 'finalized' : (data.status || 'draft'),
        data.diagnosis || null,
        data.doctor_notes || null,
        data.patient_advice || null,
        isFinal ? 1 : 0,
        isFinal ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null
      ]
    );

    const prescriptionId = orderRes.insertId;

    // 3. Insert Line Items
    const savedItems = [];
    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        let genericName = item.generic_name || null;
        let unitPrice = item.unit_price ? parseFloat(item.unit_price) : 0.00;

        // Auto-fill from medicines table if medicine_id provided
        if (item.medicine_id) {
          const [med] = await conn.query('SELECT name, generic_name, unit_price FROM medicines WHERE id = ?', [item.medicine_id]);
          if (med.length > 0) {
            if (!genericName) genericName = med[0].generic_name;
            if (!unitPrice) unitPrice = parseFloat(med[0].unit_price || 0);
          }
        }

        const [itemRes] = await conn.query(
          `INSERT INTO prescription_items 
           (prescription_id, medicine_id, medicine_name, generic_name, dosage, frequency, route, duration, instructions, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prescriptionId,
            item.medicine_id || null,
            item.medicine_name.trim(),
            genericName,
            item.dosage.trim(),
            item.frequency.trim(),
            item.route || 'Oral',
            item.duration.trim(),
            item.instructions || null,
            item.quantity || null,
            unitPrice,
            unitPrice
          ]
        );

        savedItems.push({ id: itemRes.insertId, medicine_name: item.medicine_name });

        // Maintain legacy prescriptions row for medical_records compatibility
        if (data.record_id) {
          await conn.query(
            `INSERT INTO prescriptions 
             (record_id, patient_id, doctor_id, medicine_name, dosage, frequency, duration, instructions)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              data.record_id,
              patientId,
              doctorId,
              item.medicine_name.trim(),
              item.dosage.trim(),
              item.frequency.trim(),
              item.duration.trim(),
              item.instructions || null
            ]
          );
        }
      }
    }

    return {
      id: prescriptionId,
      prescription_number: prescriptionNumber,
      status: isFinal ? 'finalized' : 'draft',
      is_locked: isFinal ? 1 : 0,
      items_count: savedItems.length,
      message: isFinal 
        ? `Prescription ${prescriptionNumber} finalized and dispatched to pharmacy.` 
        : `Draft prescription ${prescriptionNumber} saved.`
    };
  });
}

/**
 * Update Draft Prescription (Once finalized, prevents modification)
 */
async function updatePrescription(id, data, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM prescription_orders WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) throw new NotFoundError('Prescription not found.');
    const po = existing[0];

    // CRITICAL SECURITY ENFORCEMENT: Finalized / Locked records cannot be edited
    if (po.is_locked === 1 || po.status === 'finalized' || po.status === 'dispensed') {
      throw new BadRequestError('Finalized prescriptions are legally locked and cannot be modified. Issue a new prescription order instead.');
    }

    const isFinal = data.status === 'finalized';

    // 1. Update Header
    await conn.query(
      `UPDATE prescription_orders 
       SET diagnosis = ?, 
           doctor_notes = ?, 
           patient_advice = ?, 
           status = ?, 
           is_locked = ?, 
           finalized_at = ? 
       WHERE id = ?`,
      [
        data.diagnosis || po.diagnosis,
        data.doctor_notes !== undefined ? data.doctor_notes : po.doctor_notes,
        data.patient_advice !== undefined ? data.patient_advice : po.patient_advice,
        isFinal ? 'finalized' : (data.status || po.status),
        isFinal ? 1 : 0,
        isFinal ? new Date().toISOString().slice(0, 19).replace('T', ' ') : po.finalized_at,
        id
      ]
    );

    // 2. Replace Line Items
    if (data.items && Array.isArray(data.items)) {
      await conn.query('DELETE FROM prescription_items WHERE prescription_id = ?', [id]);

      for (const item of data.items) {
        let genericName = item.generic_name || null;
        let unitPrice = item.unit_price ? parseFloat(item.unit_price) : 0.00;

        if (item.medicine_id) {
          const [med] = await conn.query('SELECT generic_name, unit_price FROM medicines WHERE id = ?', [item.medicine_id]);
          if (med.length > 0) {
            if (!genericName) genericName = med[0].generic_name;
            if (!unitPrice) unitPrice = parseFloat(med[0].unit_price || 0);
          }
        }

        await conn.query(
          `INSERT INTO prescription_items 
           (prescription_id, medicine_id, medicine_name, generic_name, dosage, frequency, route, duration, instructions, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.medicine_id || null,
            item.medicine_name.trim(),
            genericName,
            item.dosage.trim(),
            item.frequency.trim(),
            item.route || 'Oral',
            item.duration.trim(),
            item.instructions || null,
            item.quantity || null,
            unitPrice,
            unitPrice
          ]
        );
      }
    }

    return {
      id,
      prescription_number: po.prescription_number,
      status: isFinal ? 'finalized' : 'draft',
      is_locked: isFinal ? 1 : 0,
      message: isFinal 
        ? `Prescription ${po.prescription_number} finalized and locked.` 
        : `Prescription ${po.prescription_number} updated.`
    };
  });
}

/**
 * Finalize & Lock Prescription
 */
async function finalizePrescription(id, actorUser = null) {
  const [existing] = await db.query('SELECT * FROM prescription_orders WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Prescription not found.');
  const po = existing[0];

  if (po.is_locked === 1 || po.status === 'finalized') {
    return { id, prescription_number: po.prescription_number, status: 'finalized', message: 'Prescription is already finalized.' };
  }

  await db.query(
    `UPDATE prescription_orders 
     SET status = 'finalized', is_locked = 1, finalized_at = NOW() 
     WHERE id = ?`,
    [id]
  );

  return {
    id,
    prescription_number: po.prescription_number,
    status: 'finalized',
    is_locked: 1,
    message: `Prescription ${po.prescription_number} finalized and locked.`
  };
}

/**
 * Dispense Prescription at Pharmacy & Update Medicine Stocks
 */
async function dispensePrescription(id, actorUser = null) {
  return await db.withTransaction(async (conn) => {
    const [existing] = await conn.query('SELECT * FROM prescription_orders WHERE id = ? FOR UPDATE', [id]);
    if (existing.length === 0) throw new NotFoundError('Prescription not found.');
    const po = existing[0];

    if (po.status === 'dispensed') {
      return { id, status: 'dispensed', message: 'Prescription has already been dispensed.' };
    }

    // Fetch items to deduct stock
    const [items] = await conn.query('SELECT medicine_id, quantity FROM prescription_items WHERE prescription_id = ?', [id]);
    for (const it of items) {
      if (it.medicine_id) {
        const qtyNum = parseInt(it.quantity, 10) || 1;
        await conn.query(
          'UPDATE medicines SET stock_quantity = GREATEST(0, stock_quantity - ?) WHERE id = ?',
          [qtyNum, it.medicine_id]
        );
      }
    }

    await conn.query(
      `UPDATE prescription_orders 
       SET status = 'dispensed', dispensed_at = NOW(), dispensed_by = ? 
       WHERE id = ?`,
      [actorUser ? actorUser.id : null, id]
    );

    return {
      id,
      prescription_number: po.prescription_number,
      status: 'dispensed',
      message: `Prescription ${po.prescription_number} marked as dispensed. Stock updated.`
    };
  });
}

/**
 * Prescription KPIs & Analytics
 */
async function getPrescriptionStats(actorUser = null) {
  const [rows] = await db.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
      SUM(CASE WHEN status = 'finalized' THEN 1 ELSE 0 END) as finalized_count,
      SUM(CASE WHEN status = 'dispensed' THEN 1 ELSE 0 END) as dispensed_count,
      (SELECT COUNT(*) FROM prescription_items) as total_items_prescribed,
      (SELECT COUNT(*) FROM medicines WHERE status = 'in_stock') as active_medicines
    FROM prescription_orders
  `);

  return rows[0];
}

module.exports = {
  listMedicines,
  listPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  finalizePrescription,
  dispensePrescription,
  getPrescriptionStats
};
