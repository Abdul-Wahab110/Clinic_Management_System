const db = require('../config/db');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

/**
 * List Wards with Live Bed Aggregations & Occupancy Rates
 */
async function listWards(query = {}) {
  const { status, ward_type, department_id, search } = query;
  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('w.status = ?');
    params.push(status);
  }

  if (ward_type && ward_type !== 'all') {
    conditions.push('w.ward_type = ?');
    params.push(ward_type);
  }

  if (department_id && department_id !== 'all') {
    conditions.push('w.department_id = ?');
    params.push(parseInt(department_id, 10));
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(w.name LIKE ? OR w.code LIKE ?)');
    params.push(term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      w.*,
      d.name as department_name,
      d.code as department_code,
      (SELECT COUNT(*) FROM rooms WHERE ward_id = w.id AND status = 'active') as total_rooms,
      (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND is_active = 1) as total_beds_count,
      (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND status = 'occupied' AND is_active = 1) as occupied_beds_count,
      (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND status = 'available' AND is_active = 1) as available_beds_count,
      (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND status = 'cleaning' AND is_active = 1) as cleaning_beds_count,
      (SELECT COUNT(*) FROM beds WHERE ward_id = w.id AND status = 'maintenance' AND is_active = 1) as maintenance_beds_count
    FROM wards w
    LEFT JOIN departments d ON w.department_id = d.id
    ${whereClause}
    ORDER BY w.floor_number ASC, w.name ASC`,
    params
  );

  return rows.map(w => ({
    ...w,
    occupancy_rate_percent: w.total_beds_count > 0 
      ? parseFloat(((w.occupied_beds_count / w.total_beds_count) * 100).toFixed(1)) 
      : 0.0
  }));
}

/**
 * Get Ward by ID with its Rooms and Beds
 */
async function getWardById(id) {
  const [rows] = await db.query(
    `SELECT w.*, d.name as department_name 
     FROM wards w 
     LEFT JOIN departments d ON w.department_id = d.id 
     WHERE w.id = ?`,
    [id]
  );
  if (rows.length === 0) throw new NotFoundError('Inpatient ward not found.');
  const ward = rows[0];

  const [rooms] = await db.query(
    `SELECT r.*,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND is_active = 1) as beds_count,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND status = 'occupied' AND is_active = 1) as occupied_count,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND status = 'available' AND is_active = 1) as available_count
     FROM rooms r 
     WHERE r.ward_id = ? 
     ORDER BY r.room_number ASC`,
    [id]
  );

  const [beds] = await db.query(
    `SELECT b.*, r.room_number,
      p.patient_code, p.first_name, p.last_name, p.gender,
      adm.admission_number, adm.admission_date, doc.first_name as doctor_first_name, doc.last_name as doctor_last_name
     FROM beds b
     JOIN rooms r ON b.room_id = r.id
     LEFT JOIN ipd_admissions adm ON b.current_admission_id = adm.id
     LEFT JOIN patients p ON adm.patient_id = p.id
     LEFT JOIN doctors d ON adm.doctor_id = d.id
     LEFT JOIN users doc ON d.user_id = doc.id
     WHERE b.ward_id = ? AND b.is_active = 1
     ORDER BY r.room_number ASC, b.bed_number ASC`,
    [id]
  );

  return {
    ...ward,
    rooms,
    beds
  };
}

/**
 * Create Ward
 */
async function createWard(data) {
  const code = data.code.trim().toUpperCase();
  const [existing] = await db.query('SELECT id FROM wards WHERE code = ? OR name = ?', [code, data.name.trim()]);
  if (existing.length > 0) throw new ConflictError(`Ward with name '${data.name}' or code '${code}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO wards 
     (department_id, name, code, ward_type, floor_number, gender_restriction, price_per_day, status, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      data.department_id ? parseInt(data.department_id, 10) : null,
      data.name.trim(),
      code,
      data.ward_type || 'general',
      parseInt(data.floor_number || 1, 10),
      data.gender_restriction || 'all',
      parseFloat(data.price_per_day || 150.00),
      data.status || 'active'
    ]
  );

  return {
    id: res.insertId,
    code,
    name: data.name,
    message: `Inpatient ward '${data.name}' created successfully.`
  };
}

/**
 * Update Ward
 */
async function updateWard(id, data) {
  const [existing] = await db.query('SELECT * FROM wards WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Ward not found.');
  const cur = existing[0];

  await db.query(
    `UPDATE wards 
     SET name = ?,
         department_id = ?,
         ward_type = ?,
         floor_number = ?,
         gender_restriction = ?,
         price_per_day = ?,
         status = ?,
         is_active = ?
     WHERE id = ?`,
    [
      data.name !== undefined ? data.name.trim() : cur.name,
      data.department_id !== undefined ? (data.department_id ? parseInt(data.department_id, 10) : null) : cur.department_id,
      data.ward_type || cur.ward_type,
      data.floor_number !== undefined ? parseInt(data.floor_number, 10) : cur.floor_number,
      data.gender_restriction || cur.gender_restriction,
      data.price_per_day !== undefined ? parseFloat(data.price_per_day) : cur.price_per_day,
      data.status || cur.status,
      data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active,
      id
    ]
  );

  return { id, message: 'Ward updated successfully.' };
}

/**
 * List Rooms
 */
async function listRooms(query = {}) {
  const { ward_id, room_type, status } = query;
  const conditions = [];
  const params = [];

  if (ward_id && ward_id !== 'all') {
    conditions.push('r.ward_id = ?');
    params.push(parseInt(ward_id, 10));
  }

  if (room_type && room_type !== 'all') {
    conditions.push('r.room_type = ?');
    params.push(room_type);
  }

  if (status && status !== 'all') {
    conditions.push('r.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await db.query(
    `SELECT 
      r.*,
      w.name as ward_name,
      w.code as ward_code,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND is_active = 1) as total_beds,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND status = 'occupied' AND is_active = 1) as occupied_beds,
      (SELECT COUNT(*) FROM beds WHERE room_id = r.id AND status = 'available' AND is_active = 1) as available_beds
    FROM rooms r
    JOIN wards w ON r.ward_id = w.id
    ${whereClause}
    ORDER BY w.name ASC, r.room_number ASC`,
    params
  );

  return rows;
}

/**
 * Create Room
 */
async function createRoom(data) {
  const roomNum = data.room_number.trim().toUpperCase();
  const [existing] = await db.query('SELECT id FROM rooms WHERE room_number = ?', [roomNum]);
  if (existing.length > 0) throw new ConflictError(`Room number '${roomNum}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO rooms 
     (ward_id, room_number, room_type, floor_number, capacity_beds, daily_rate, amenities, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parseInt(data.ward_id, 10),
      roomNum,
      data.room_type || 'general_shared',
      parseInt(data.floor_number || 1, 10),
      parseInt(data.capacity_beds || 2, 10),
      parseFloat(data.daily_rate || 200.00),
      data.amenities ? data.amenities.trim() : null,
      data.status || 'active'
    ]
  );

  return {
    id: res.insertId,
    room_number: roomNum,
    message: `Room '${roomNum}' created successfully.`
  };
}

/**
 * Update Room
 */
async function updateRoom(id, data) {
  const [existing] = await db.query('SELECT * FROM rooms WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Room not found.');
  const cur = existing[0];

  await db.query(
    `UPDATE rooms 
     SET room_number = ?,
         room_type = ?,
         floor_number = ?,
         capacity_beds = ?,
         daily_rate = ?,
         amenities = ?,
         status = ?
     WHERE id = ?`,
    [
      data.room_number !== undefined ? data.room_number.trim().toUpperCase() : cur.room_number,
      data.room_type || cur.room_type,
      data.floor_number !== undefined ? parseInt(data.floor_number, 10) : cur.floor_number,
      data.capacity_beds !== undefined ? parseInt(data.capacity_beds, 10) : cur.capacity_beds,
      data.daily_rate !== undefined ? parseFloat(data.daily_rate) : cur.daily_rate,
      data.amenities !== undefined ? data.amenities : cur.amenities,
      data.status || cur.status,
      id
    ]
  );

  return { id, message: 'Room updated successfully.' };
}

/**
 * List Beds (with active patient details if occupied)
 */
async function listBeds(query = {}) {
  const { ward_id, room_id, status, bed_type } = query;
  const conditions = ['b.is_active = 1'];
  const params = [];

  if (ward_id && ward_id !== 'all') {
    conditions.push('b.ward_id = ?');
    params.push(parseInt(ward_id, 10));
  }

  if (room_id && room_id !== 'all') {
    conditions.push('b.room_id = ?');
    params.push(parseInt(room_id, 10));
  }

  if (status && status !== 'all') {
    conditions.push('b.status = ?');
    params.push(status);
  }

  if (bed_type && bed_type !== 'all') {
    conditions.push('b.bed_type = ?');
    params.push(bed_type);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const [rows] = await db.query(
    `SELECT 
      b.*,
      r.room_number,
      r.room_type,
      w.name as ward_name,
      w.code as ward_code,
      p.id as patient_id,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      p.blood_group as patient_blood_group,
      adm.id as admission_id,
      adm.admission_number,
      adm.admission_date,
      adm.admitting_diagnosis,
      doc_u.full_name as attending_doctor_name
    FROM beds b
    JOIN rooms r ON b.room_id = r.id
    JOIN wards w ON b.ward_id = w.id
    LEFT JOIN ipd_admissions adm ON b.current_admission_id = adm.id
    LEFT JOIN patients p ON adm.patient_id = p.id
    LEFT JOIN doctors doc ON adm.doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    ${whereClause}
    ORDER BY w.name ASC, r.room_number ASC, b.bed_number ASC`,
    params
  );

  return rows;
}

/**
 * Get Hierarchical Bed Visual Matrix for CSS Grid UI
 */
async function getBedVisualMatrix() {
  const [wards] = await db.query(`
    SELECT id, name, code, ward_type, floor_number, total_beds, occupied_beds, price_per_day, status
    FROM wards
    WHERE is_active = 1
    ORDER BY floor_number ASC, name ASC
  `);

  const [beds] = await db.query(`
    SELECT 
      b.*,
      r.room_number,
      r.room_type,
      p.id as patient_id,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      adm.id as admission_id,
      adm.admission_number,
      adm.admission_date,
      adm.admitting_diagnosis,
      doc_u.full_name as attending_doctor_name
    FROM beds b
    JOIN rooms r ON b.room_id = r.id
    LEFT JOIN ipd_admissions adm ON b.current_admission_id = adm.id
    LEFT JOIN patients p ON adm.patient_id = p.id
    LEFT JOIN doctors doc ON adm.doctor_id = doc.id
    LEFT JOIN users doc_u ON doc.user_id = doc_u.id
    WHERE b.is_active = 1
    ORDER BY b.ward_id ASC, r.room_number ASC, b.bed_number ASC
  `);

  // Group beds by ward
  return wards.map(w => {
    const wardBeds = beds.filter(b => b.ward_id === w.id);
    return {
      ...w,
      beds_count: wardBeds.length,
      available_count: wardBeds.filter(b => b.status === 'available').length,
      occupied_count: wardBeds.filter(b => b.status === 'occupied').length,
      cleaning_count: wardBeds.filter(b => b.status === 'cleaning').length,
      maintenance_count: wardBeds.filter(b => b.status === 'maintenance').length,
      beds: wardBeds
    };
  });
}

/**
 * Create Bed
 */
async function createBed(data) {
  const bedNum = data.bed_number.trim().toUpperCase();
  const [existing] = await db.query('SELECT id FROM beds WHERE bed_number = ?', [bedNum]);
  if (existing.length > 0) throw new ConflictError(`Bed number '${bedNum}' already exists.`);

  const [res] = await db.query(
    `INSERT INTO beds 
     (room_id, ward_id, bed_number, bed_type, status, daily_rate, features, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [
      parseInt(data.room_id, 10),
      parseInt(data.ward_id, 10),
      bedNum,
      data.bed_type || 'standard_manual',
      data.status || 'available',
      parseFloat(data.daily_rate || 100.00),
      data.features ? data.features.trim() : null
    ]
  );

  // Update total_beds count in ward
  await db.query(`
    UPDATE wards 
    SET total_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = ? AND is_active = 1)
    WHERE id = ?
  `, [data.ward_id, data.ward_id]);

  return {
    id: res.insertId,
    bed_number: bedNum,
    message: `Bed '${bedNum}' created successfully.`
  };
}

/**
 * Update Bed Status (e.g. Set Cleaning / Available / Maintenance)
 */
async function updateBedStatus(id, data) {
  const [existing] = await db.query('SELECT * FROM beds WHERE id = ?', [id]);
  if (existing.length === 0) throw new NotFoundError('Bed not found.');
  const cur = existing[0];

  const newStatus = data.status;
  if (!['available', 'occupied', 'reserved', 'cleaning', 'maintenance'].includes(newStatus)) {
    throw new BadRequestError('Invalid bed status.');
  }

  // Prevent changing occupied bed to available without discharge
  if (cur.status === 'occupied' && newStatus === 'available' && cur.current_admission_id) {
    throw new BadRequestError('Cannot set occupied bed to available. Process patient discharge or transfer first.');
  }

  await db.query(
    'UPDATE beds SET status = ? WHERE id = ?',
    [newStatus, id]
  );

  // Update ward counts
  await db.query(`
    UPDATE wards 
    SET occupied_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = ? AND status = 'occupied' AND is_active = 1)
    WHERE id = ?
  `, [cur.ward_id, cur.ward_id]);

  return { id, status: newStatus, message: `Bed status updated to '${newStatus}'.` };
}

/**
 * List IPD Admissions with Search & Multi-Criteria Filtering
 */
async function listAdmissions(query = {}) {
  const {
    status,
    ward_id,
    doctor_id,
    patient_id,
    date_from,
    date_to,
    search,
    page = 1,
    limit = 50
  } = query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    conditions.push('adm.status = ?');
    params.push(status);
  }

  if (ward_id && ward_id !== 'all') {
    conditions.push('adm.ward_id = ?');
    params.push(parseInt(ward_id, 10));
  }

  if (doctor_id && doctor_id !== 'all') {
    conditions.push('adm.doctor_id = ?');
    params.push(parseInt(doctor_id, 10));
  }

  if (patient_id) {
    conditions.push('adm.patient_id = ?');
    params.push(parseInt(patient_id, 10));
  }

  if (date_from) {
    conditions.push('adm.admission_date >= ?');
    params.push(date_from);
  }
  if (date_to) {
    conditions.push('adm.admission_date <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(adm.admission_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR p.cnic LIKE ?)');
    params.push(term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM ipd_admissions adm
    JOIN patients p ON adm.patient_id = p.id
    ${whereClause}
  `;
  const [countRows] = await db.query(countSql, params);
  const total = countRows[0].total;

  const dataSql = `
    SELECT 
      adm.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      p.blood_group as patient_blood_group,
      p.phone as patient_phone,
      w.name as ward_name,
      w.code as ward_code,
      r.room_number,
      b.bed_number,
      dept.name as department_name,
      doc_u.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      DATEDIFF(COALESCE(adm.discharge_date, NOW()), adm.admission_date) as length_of_stay_days
    FROM ipd_admissions adm
    JOIN patients p ON adm.patient_id = p.id
    JOIN wards w ON adm.ward_id = w.id
    JOIN rooms r ON adm.room_id = r.id
    JOIN beds b ON adm.bed_id = b.id
    JOIN departments dept ON adm.department_id = dept.id
    JOIN doctors doc ON adm.doctor_id = doc.id
    JOIN users doc_u ON doc.user_id = doc_u.id
    ${whereClause}
    ORDER BY adm.admission_date DESC, adm.id DESC
    LIMIT ? OFFSET ?
  `;

  const [rows] = await db.query(dataSql, [...params, limitNum, offset]);

  return {
    admissions: rows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * Get Admission by ID with Full Clinical History
 */
async function getAdmissionById(id) {
  const [rows] = await db.query(
    `SELECT 
      adm.*,
      p.patient_code,
      p.first_name as patient_first_name,
      p.last_name as patient_last_name,
      p.gender as patient_gender,
      p.dob as patient_dob,
      p.blood_group as patient_blood_group,
      p.allergies as patient_allergies,
      p.phone as patient_phone,
      p.address as patient_address,
      w.name as ward_name,
      w.code as ward_code,
      w.price_per_day as ward_daily_rate,
      r.room_number,
      r.room_type,
      b.bed_number,
      b.bed_type,
      b.daily_rate as bed_daily_rate,
      dept.name as department_name,
      doc_u.full_name as doctor_name,
      doc.specialization as doctor_specialization,
      doc_u.phone as doctor_phone,
      nurse_u.full_name as primary_nurse_name,
      dis_u.full_name as discharged_by_name,
      DATEDIFF(COALESCE(adm.discharge_date, NOW()), adm.admission_date) as length_of_stay_days
    FROM ipd_admissions adm
    JOIN patients p ON adm.patient_id = p.id
    JOIN wards w ON adm.ward_id = w.id
    JOIN rooms r ON adm.room_id = r.id
    JOIN beds b ON adm.bed_id = b.id
    JOIN departments dept ON adm.department_id = dept.id
    JOIN doctors doc ON adm.doctor_id = doc.id
    JOIN users doc_u ON doc.user_id = doc_u.id
    LEFT JOIN users nurse_u ON adm.primary_nurse_id = nurse_u.id
    LEFT JOIN users dis_u ON adm.discharged_by = dis_u.id
    WHERE adm.id = ?`,
    [id]
  );

  if (rows.length === 0) throw new NotFoundError('Inpatient admission record not found.');
  const admission = rows[0];

  // Fetch Daily Clinical Rounds
  const [rounds] = await db.query(
    `SELECT r.*, u.full_name as doctor_name, doc.specialization
     FROM ipd_daily_rounds r
     JOIN doctors doc ON r.doctor_id = doc.id
     JOIN users u ON doc.user_id = u.id
     WHERE r.admission_id = ?
     ORDER BY r.round_date DESC`,
    [id]
  );

  // Fetch Patient Transfers History
  const [transfers] = await db.query(
    `SELECT t.*,
      fw.name as from_ward_name, fr.room_number as from_room_number, fb.bed_number as from_bed_number,
      tw.name as to_ward_name, tr.room_number as to_room_number, tb.bed_number as to_bed_number,
      u.full_name as transferred_by_name
     FROM ipd_patient_transfers t
     JOIN wards fw ON t.from_ward_id = fw.id
     JOIN rooms fr ON t.from_room_id = fr.id
     JOIN beds fb ON t.from_bed_id = fb.id
     JOIN wards tw ON t.to_ward_id = tw.id
     JOIN rooms tr ON t.to_room_id = tr.id
     JOIN beds tb ON t.to_bed_id = tb.id
     LEFT JOIN users u ON t.transferred_by = u.id
     WHERE t.admission_id = ?
     ORDER BY t.transfer_date DESC`,
    [id]
  );

  return {
    ...admission,
    daily_rounds: rounds,
    transfers
  };
}

/**
 * Create IPD Admission with Strict Zero Double-Bed Assignment Rule
 */
async function createAdmission(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const patientId = parseInt(data.patient_id, 10);
    const doctorId = parseInt(data.doctor_id, 10);
    const departmentId = parseInt(data.department_id, 10);
    const wardId = parseInt(data.ward_id, 10);
    const roomId = parseInt(data.room_id, 10);
    const bedId = parseInt(data.bed_id, 10);

    // 1. Check for existing active admission for this patient
    const [existingActive] = await connection.query(
      "SELECT id, admission_number FROM ipd_admissions WHERE patient_id = ? AND status IN ('admitted', 'under_treatment')",
      [patientId]
    );
    if (existingActive.length > 0) {
      throw new ConflictError(`Patient already has an active inpatient admission (${existingActive[0].admission_number}).`);
    }

    // 2. STRICT RULE: Check and lock requested bed FOR UPDATE
    const [bedRows] = await connection.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [bedId]);
    if (bedRows.length === 0) throw new NotFoundError('Target bed not found.');
    const bed = bedRows[0];

    if (bed.status !== 'available') {
      throw new ConflictError(
        `Bed '${bed.bed_number}' is currently ${bed.status.toUpperCase()} and cannot be assigned. Please select an available bed.`
      );
    }

    // 3. Generate unique Admission Number
    const admNumber = `IPD-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const admDate = data.admission_date || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 4. Insert IPD Admission
    const [res] = await connection.query(
      `INSERT INTO ipd_admissions 
       (admission_number, patient_id, doctor_id, department_id, ward_id, room_id, bed_id, primary_nurse_id, admission_date, admission_type, admitting_diagnosis, chief_complaint, emergency_contact_name, emergency_contact_phone, emergency_contact_relation, insurance_provider, insurance_policy_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admitted')`,
      [
        admNumber,
        patientId,
        doctorId,
        departmentId,
        wardId,
        roomId,
        bedId,
        data.primary_nurse_id ? parseInt(data.primary_nurse_id, 10) : null,
        admDate,
        data.admission_type || 'elective_planned',
        data.admitting_diagnosis.trim(),
        data.chief_complaint ? data.chief_complaint.trim() : null,
        data.emergency_contact_name ? data.emergency_contact_name.trim() : null,
        data.emergency_contact_phone ? data.emergency_contact_phone.trim() : null,
        data.emergency_contact_relation ? data.emergency_contact_relation.trim() : null,
        data.insurance_provider ? data.insurance_provider.trim() : null,
        data.insurance_policy_number ? data.insurance_policy_number.trim() : null
      ]
    );

    const admissionId = res.insertId;

    // 5. Update Bed Status to 'occupied'
    await connection.query(
      "UPDATE beds SET status = 'occupied', current_admission_id = ? WHERE id = ?",
      [admissionId, bedId]
    );

    // 6. Update Ward Occupied Beds Count
    await connection.query(`
      UPDATE wards 
      SET occupied_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = ? AND status = 'occupied' AND is_active = 1)
      WHERE id = ?
    `, [wardId, wardId]);

    // 7. If initial clinical progress notes provided, record daily round
    if (data.initial_progress_notes) {
      await connection.query(
        `INSERT INTO ipd_daily_rounds 
         (admission_id, doctor_id, round_date, progress_notes, treatment_plan, nursing_instructions)
         VALUES (?, ?, NOW(), ?, ?, ?)`,
        [
          admissionId,
          doctorId,
          data.initial_progress_notes.trim(),
          data.initial_treatment_plan ? data.initial_treatment_plan.trim() : 'Initial admitting care plan initiated.',
          data.initial_nursing_orders ? data.initial_nursing_orders.trim() : 'Standard vitals monitoring every 4 hours.'
        ]
      );
    }

    await connection.commit();

    return {
      id: admissionId,
      admission_number: admNumber,
      patient_id: patientId,
      bed_number: bed.bed_number,
      status: 'admitted',
      message: `Patient admitted successfully to Bed ${bed.bed_number} (${admNumber}).`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Transfer Patient between Wards / Rooms / Beds with Full Audit History
 */
async function transferPatient(data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const admissionId = parseInt(data.admission_id, 10);
    const toBedId = parseInt(data.to_bed_id, 10);

    // 1. Fetch and lock admission
    const [admRows] = await connection.query('SELECT * FROM ipd_admissions WHERE id = ? FOR UPDATE', [admissionId]);
    if (admRows.length === 0) throw new NotFoundError('Admission not found.');
    const adm = admRows[0];

    if (!['admitted', 'under_treatment'].includes(adm.status)) {
      throw new BadRequestError(`Cannot transfer patient with status '${adm.status}'. Patient must be actively admitted.`);
    }

    if (adm.bed_id === toBedId) {
      throw new BadRequestError('Patient is already assigned to this bed.');
    }

    // 2. Fetch and lock destination bed
    const [toBedRows] = await connection.query('SELECT * FROM beds WHERE id = ? FOR UPDATE', [toBedId]);
    if (toBedRows.length === 0) throw new NotFoundError('Destination bed not found.');
    const toBed = toBedRows[0];

    if (toBed.status !== 'available') {
      throw new ConflictError(
        `Destination bed '${toBed.bed_number}' is currently ${toBed.status.toUpperCase()} and cannot accept transfers.`
      );
    }

    const fromWardId = adm.ward_id;
    const fromRoomId = adm.room_id;
    const fromBedId = adm.bed_id;
    const toWardId = toBed.ward_id;
    const toRoomId = toBed.room_id;

    // 3. Generate Transfer Number
    const trfNumber = `TRF-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // 4. Record Transfer Audit Log
    await connection.query(
      `INSERT INTO ipd_patient_transfers 
       (transfer_number, admission_id, patient_id, from_ward_id, from_room_id, from_bed_id, to_ward_id, to_room_id, to_bed_id, transfer_reason, transfer_date, transferred_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        trfNumber,
        admissionId,
        adm.patient_id,
        fromWardId,
        fromRoomId,
        fromBedId,
        toWardId,
        toRoomId,
        toBedId,
        data.transfer_reason.trim(),
        actorUser ? actorUser.id : 1
      ]
    );

    // 5. Release old bed (set status to 'cleaning' for sanitization)
    await connection.query(
      "UPDATE beds SET status = 'cleaning', current_admission_id = NULL WHERE id = ?",
      [fromBedId]
    );

    // 6. Occupy new bed
    await connection.query(
      "UPDATE beds SET status = 'occupied', current_admission_id = ? WHERE id = ?",
      [admissionId, toBedId]
    );

    // 7. Update IPD Admission location
    await connection.query(
      "UPDATE ipd_admissions SET ward_id = ?, room_id = ?, bed_id = ?, status = 'under_treatment' WHERE id = ?",
      [toWardId, toRoomId, toBedId, admissionId]
    );

    // 8. Update ward occupied counts for both wards
    await connection.query(`
      UPDATE wards 
      SET occupied_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = ? AND status = 'occupied' AND is_active = 1)
      WHERE id IN (?, ?)
    `, [fromWardId, fromWardId, toWardId]);

    await connection.commit();

    return {
      transfer_number: trfNumber,
      admission_id: admissionId,
      new_bed_number: toBed.bed_number,
      message: `Patient transferred to Bed ${toBed.bed_number} successfully. Previous bed is marked for cleaning.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Discharge Patient with Clinical Summary and Automatic Bed Release
 */
async function dischargePatient(id, data, actorUser) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const admissionId = parseInt(id, 10);
    const [admRows] = await connection.query('SELECT * FROM ipd_admissions WHERE id = ? FOR UPDATE', [admissionId]);
    if (admRows.length === 0) throw new NotFoundError('Admission not found.');
    const adm = admRows[0];

    if (adm.status === 'discharged') {
      throw new BadRequestError('Patient has already been discharged.');
    }

    const dischargeDate = data.discharge_date || new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 1. Update Admission record
    await connection.query(
      `UPDATE ipd_admissions 
       SET status = 'discharged',
           discharge_date = ?,
           discharge_type = ?,
           discharge_summary = ?,
           final_diagnosis = ?,
           discharge_advice = ?,
           follow_up_date = ?,
           discharged_by = ?
       WHERE id = ?`,
      [
        dischargeDate,
        data.discharge_type || 'routine_recovered',
        data.discharge_summary.trim(),
        data.final_diagnosis.trim(),
        data.discharge_advice ? data.discharge_advice.trim() : null,
        data.follow_up_date || null,
        actorUser ? actorUser.id : 1,
        admissionId
      ]
    );

    // 2. Release bed and set to 'cleaning'
    await connection.query(
      "UPDATE beds SET status = 'cleaning', current_admission_id = NULL WHERE id = ?",
      [adm.bed_id]
    );

    // 3. Update ward occupied counts
    await connection.query(`
      UPDATE wards 
      SET occupied_beds = (SELECT COUNT(*) FROM beds WHERE ward_id = ? AND status = 'occupied' AND is_active = 1)
      WHERE id = ?
    `, [adm.ward_id, adm.ward_id]);

    await connection.commit();

    return {
      admission_id: admissionId,
      admission_number: adm.admission_number,
      discharge_date: dischargeDate,
      status: 'discharged',
      message: `Patient successfully discharged from Admission ${adm.admission_number}. Bed released for sanitation.`
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Add Daily Clinical Round / Doctor Care Progress Notes
 */
async function addDailyRound(admissionId, data, actorUser) {
  const [adm] = await db.query('SELECT * FROM ipd_admissions WHERE id = ?', [admissionId]);
  if (adm.length === 0) throw new NotFoundError('Admission not found.');

  const doctorId = data.doctor_id ? parseInt(data.doctor_id, 10) : adm[0].doctor_id;

  const [res] = await db.query(
    `INSERT INTO ipd_daily_rounds 
     (admission_id, doctor_id, round_date, progress_notes, treatment_plan, nursing_instructions, vitals_id)
     VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
    [
      parseInt(admissionId, 10),
      doctorId,
      data.progress_notes.trim(),
      data.treatment_plan.trim(),
      data.nursing_instructions ? data.nursing_instructions.trim() : null,
      data.vitals_id ? parseInt(data.vitals_id, 10) : null
    ]
  );

  return {
    id: res.insertId,
    admission_id: admissionId,
    message: 'Daily clinical progress round note recorded successfully.'
  };
}

/**
 * List Daily Clinical Rounds for an Admission
 */
async function listDailyRounds(admissionId) {
  const [rows] = await db.query(
    `SELECT r.*, u.full_name as doctor_name, doc.specialization
     FROM ipd_daily_rounds r
     JOIN doctors doc ON r.doctor_id = doc.id
     JOIN users u ON doc.user_id = u.id
     WHERE r.admission_id = ?
     ORDER BY r.round_date DESC`,
    [admissionId]
  );
  return rows;
}

/**
 * IPD KPIs and Hospital Occupancy Statistics
 */
async function getIpdStats() {
  const [wardStats] = await db.query(`
    SELECT 
      COUNT(*) as total_wards,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_wards
    FROM wards
  `);

  const [bedStats] = await db.query(`
    SELECT 
      COUNT(*) as total_beds,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available_beds,
      SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) as occupied_beds,
      SUM(CASE WHEN status = 'cleaning' THEN 1 ELSE 0 END) as cleaning_beds,
      SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance_beds,
      SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved_beds
    FROM beds
    WHERE is_active = 1
  `);

  const [admStats] = await db.query(`
    SELECT 
      COUNT(*) as total_admissions,
      SUM(CASE WHEN status IN ('admitted', 'under_treatment') THEN 1 ELSE 0 END) as active_inpatient_admissions,
      SUM(CASE WHEN DATE(admission_date) = CURDATE() THEN 1 ELSE 0 END) as admissions_today,
      SUM(CASE WHEN status = 'discharged' AND DATE(discharge_date) = CURDATE() THEN 1 ELSE 0 END) as discharges_today
    FROM ipd_admissions
  `);

  const totalBeds = bedStats[0].total_beds || 0;
  const occupiedBeds = bedStats[0].occupied_beds || 0;
  const occupancyRate = totalBeds > 0 ? parseFloat(((occupiedBeds / totalBeds) * 100).toFixed(1)) : 0.0;

  return {
    ...wardStats[0],
    ...bedStats[0],
    ...admStats[0],
    occupancy_rate_percent: occupancyRate
  };
}

module.exports = {
  listWards,
  getWardById,
  createWard,
  updateWard,
  listRooms,
  createRoom,
  updateRoom,
  listBeds,
  getBedVisualMatrix,
  createBed,
  updateBedStatus,
  listAdmissions,
  getAdmissionById,
  createAdmission,
  transferPatient,
  dischargePatient,
  addDailyRound,
  listDailyRounds,
  getIpdStats
};
