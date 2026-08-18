const db = require('../config/db');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');
const { createAuditLog } = require('./audit.service');

/**
 * Resolve Doctor Record from Authenticated User
 */
async function getDoctorIdFromUser(user) {
  if (!user) throw new ForbiddenError('Authentication required.');

  const [rows] = await db.query(
    `SELECT doc.*, u.full_name as name, u.email, u.phone, 
            dept.name as department_name, dept.code as department_code
     FROM doctors doc
     JOIN users u ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     WHERE doc.user_id = ? LIMIT 1`,
    [user.id]
  );

  if (rows.length === 0) {
    // If admin is testing/viewing, allow fallback to physician ID 1
    if (user.role === 'super_admin' || user.role === 'hospital_admin') {
      const [adminFallback] = await db.query(
        `SELECT doc.*, u.full_name as name, u.email, u.phone, 
                dept.name as department_name, dept.code as department_code
         FROM doctors doc
         JOIN users u ON doc.user_id = u.id
         LEFT JOIN departments dept ON doc.department_id = dept.id
         WHERE doc.id = 1 LIMIT 1`
      );
      if (adminFallback.length > 0) return adminFallback[0];
    }
    throw new NotFoundError('No physician clinical profile is associated with this user account.');
  }

  return rows[0];
}

/**
 * 1. Comprehensive Doctor Dashboard Overview (Real-Time Dynamic MySQL Data)
 */
async function getDoctorDashboardOverview(user) {
  const doctor = await getDoctorIdFromUser(user);
  const doctorId = doctor.id;
  const departmentId = doctor.department_id;

  // 1. Today's Scheduled Appointments
  const [todayAppointments] = await db.query(
    `SELECT 
      a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.type, a.status, a.reason,
      p.id as patient_id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.blood_group, p.allergies,
      d.name as department_name,
      q.id as queue_id, q.token_number, q.status as queue_status
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     JOIN departments d ON a.department_id = d.id
     LEFT JOIN opd_queues q ON q.appointment_id = a.id AND q.queue_date = CURDATE()
     WHERE a.doctor_id = ? AND a.appointment_date = CURDATE()
     ORDER BY a.appointment_time ASC`,
    [doctorId]
  );

  // 2. Waiting Patients in Live OPD Queue
  const [waitingPatients] = await db.query(
    `SELECT 
      q.id, q.token_number, q.token_sequence, q.status, q.priority, q.queue_date, q.check_in_time, q.called_time, q.chief_complaint,
      p.id as patient_id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.blood_group, p.allergies,
      v.systolic, v.diastolic, v.heart_rate, v.temperature, v.bmi, v.oxygen_saturation
     FROM opd_queues q
     JOIN patients p ON q.patient_id = p.id
     LEFT JOIN vitals v ON q.vitals_id = v.id
     WHERE (q.doctor_id = ? OR (q.doctor_id IS NULL AND q.department_id = ?))
       AND q.queue_date = CURDATE()
       AND q.status IN ('waiting', 'in_consultation')
     ORDER BY 
       CASE WHEN q.status = 'in_consultation' THEN 1 ELSE 2 END,
       CASE WHEN q.priority = 'emergency' THEN 1 WHEN q.priority = 'urgent' THEN 2 ELSE 3 END,
       q.token_sequence ASC`,
    [doctorId, departmentId]
  );

  // 3. Completed Consultations Today
  const [completedToday] = await db.query(
    `SELECT 
      mr.id, mr.record_date, mr.chief_complaint, mr.diagnosis, mr.treatment_plan, mr.created_at,
      p.id as patient_id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth
     FROM medical_records mr
     JOIN patients p ON mr.patient_id = p.id
     WHERE mr.doctor_id = ? AND DATE(mr.created_at) = CURDATE()
     ORDER BY mr.created_at DESC`,
    [doctorId]
  );

  // 4. Follow-up Patients Roster (Due today or upcoming)
  const [followUps] = await db.query(
    `SELECT 
      mr.id as record_id, mr.patient_id, mr.diagnosis, mr.treatment_plan, mr.follow_up_date, mr.created_at as visit_date,
      p.patient_code, p.first_name, p.last_name, p.phone, p.gender, p.date_of_birth, p.blood_group
     FROM medical_records mr
     JOIN patients p ON mr.patient_id = p.id
     WHERE mr.doctor_id = ? AND mr.follow_up_date IS NOT NULL AND mr.follow_up_date >= CURDATE()
     ORDER BY mr.follow_up_date ASC
     LIMIT 10`,
    [doctorId]
  );

  // 5. Pending Laboratory Results Ordered by Doctor
  const [pendingLabResults] = await db.query(
    `SELECT 
      lo.id, lo.order_number, lo.order_date, lo.status, lo.priority, lo.clinical_notes,
      p.id as patient_id, p.patient_code, p.first_name, p.last_name, p.gender, p.phone,
      (SELECT COUNT(*) FROM lab_order_items WHERE order_id = lo.id) as items_count,
      (SELECT GROUP_CONCAT(COALESCE(loi.test_name, lt.name) SEPARATOR ', ') 
       FROM lab_order_items loi 
       LEFT JOIN lab_tests lt ON loi.test_id = lt.id 
       WHERE loi.order_id = lo.id) as test_names
     FROM lab_orders lo
     JOIN patients p ON lo.patient_id = p.id
     WHERE lo.doctor_id = ? AND lo.status IN ('pending', 'sample_collected', 'in_progress', 'processing')
     ORDER BY lo.order_date DESC, lo.id DESC
     LIMIT 10`,
    [doctorId]
  );

  // 6. Aggregated Lifetime Doctor KPIs
  const [totalPatientsRow] = await db.query(
    `SELECT COUNT(DISTINCT patient_id) as total_patients FROM medical_records WHERE doctor_id = ?`,
    [doctorId]
  );

  const [totalPrescriptionsRow] = await db.query(
    `SELECT COUNT(*) as total_rx FROM prescription_orders WHERE doctor_id = ?`,
    [doctorId]
  );

  const waitingCount = waitingPatients.filter(p => p.status === 'waiting').length;
  const inConsultationCount = waitingPatients.filter(p => p.status === 'in_consultation').length;

  return {
    doctor: {
      id: doctor.id,
      doctor_code: doctor.doctor_code,
      name: doctor.name,
      email: doctor.email,
      phone: doctor.phone,
      department_name: doctor.department_name,
      department_code: doctor.department_code,
      specialization: doctor.specialization,
      qualification: doctor.qualification,
      license_number: doctor.license_number,
      room_number: doctor.room_number,
      consultation_fee: parseFloat(doctor.consultation_fee) || 0,
      is_available: !!doctor.is_available,
      status: doctor.status
    },
    metrics: {
      today_appointments_count: todayAppointments.length,
      waiting_patients_count: waitingCount,
      in_consultation_count: inConsultationCount,
      completed_consultations_count: completedToday.length,
      follow_ups_due_count: followUps.length,
      pending_lab_orders_count: pendingLabResults.length,
      total_unique_patients: totalPatientsRow[0].total_patients || 0,
      total_prescriptions_written: totalPrescriptionsRow[0].total_rx || 0
    },
    today_appointments: todayAppointments,
    waiting_patients: waitingPatients,
    completed_today: completedToday,
    follow_ups: followUps,
    pending_lab_results: pendingLabResults
  };
}

/**
 * 2. Get Doctor Appointments with Multi-Criteria Filters
 */
async function getDoctorAppointments(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { date, status, timeframe, search } = query;

  const conditions = ['a.doctor_id = ?'];
  const params = [doctor.id];

  if (status && status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (date) {
    conditions.push('a.appointment_date = ?');
    params.push(date);
  } else if (timeframe === 'today') {
    conditions.push('a.appointment_date = CURDATE()');
  } else if (timeframe === 'upcoming') {
    conditions.push('a.appointment_date >= CURDATE()');
  } else if (timeframe === 'past') {
    conditions.push('a.appointment_date < CURDATE()');
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR a.appointment_number LIKE ?)');
    params.push(s, s, s, s);
  }

  const [rows] = await db.query(
    `SELECT 
      a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.type, a.status, a.reason, a.notes,
      p.id as patient_id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.blood_group, p.allergies,
      d.name as department_name,
      q.id as queue_id, q.token_number, q.status as queue_status
     FROM appointments a
     JOIN patients p ON a.patient_id = p.id
     JOIN departments d ON a.department_id = d.id
     LEFT JOIN opd_queues q ON q.appointment_id = a.id AND q.queue_date = a.appointment_date
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.appointment_date DESC, a.appointment_time ASC`,
    params
  );

  return rows;
}

/**
 * 3. Get Doctor Patients Directory (Patients seen by this doctor)
 */
async function getDoctorPatients(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { search } = query;

  const conditions = [
    '(mr.doctor_id = ? OR a.doctor_id = ? OR po.doctor_id = ?)'
  ];
  const params = [doctor.id, doctor.id, doctor.id];

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR p.phone LIKE ?)');
    params.push(s, s, s, s);
  }

  const [rows] = await db.query(
    `SELECT 
      p.id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.blood_group, p.phone, p.email, p.address,
      p.allergies, p.medical_history, p.emergency_contact_phone,
      COUNT(DISTINCT mr.id) as visit_count,
      MAX(mr.record_date) as last_visit_date,
      GROUP_CONCAT(DISTINCT mr.diagnosis SEPARATOR '; ') as past_diagnoses
     FROM patients p
     LEFT JOIN medical_records mr ON mr.patient_id = p.id AND mr.doctor_id = ?
     LEFT JOIN appointments a ON a.patient_id = p.id AND a.doctor_id = ?
     LEFT JOIN prescription_orders po ON po.patient_id = p.id AND po.doctor_id = ?
     WHERE ${conditions.join(' AND ')}
     GROUP BY p.id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.blood_group, p.phone, p.email, p.address, p.allergies, p.medical_history, p.emergency_contact_phone
     ORDER BY last_visit_date DESC, p.last_name ASC`,
    [doctor.id, doctor.id, doctor.id, ...params]
  );

  return rows;
}

/**
 * 4. Get Doctor Consultations & Clinical Notes
 */
async function getDoctorConsultations(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { date, search } = query;

  const conditions = ['mr.doctor_id = ?'];
  const params = [doctor.id];

  if (date) {
    conditions.push('mr.record_date = ?');
    params.push(date);
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR mr.diagnosis LIKE ? OR mr.chief_complaint LIKE ?)');
    params.push(s, s, s, s, s);
  }

  const [rows] = await db.query(
    `SELECT 
      mr.id, mr.patient_id, mr.appointment_id, mr.opd_queue_id, mr.record_date, mr.chief_complaint, mr.symptoms,
      mr.physical_examination, mr.diagnosis, mr.treatment_plan, mr.clinical_notes, mr.doctor_notes, mr.follow_up_date,
      mr.encounter_type, mr.created_at,
      p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.blood_group, p.allergies,
      v.systolic, v.diastolic, v.heart_rate, v.temperature, v.bmi, v.oxygen_saturation,
      (SELECT COUNT(*) FROM prescription_orders WHERE record_id = mr.id) as prescriptions_count,
      (SELECT COUNT(*) FROM lab_orders WHERE record_id = mr.id) as lab_orders_count
     FROM medical_records mr
     JOIN patients p ON mr.patient_id = p.id
     LEFT JOIN vitals v ON mr.vitals_id = v.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY mr.record_date DESC, mr.created_at DESC`,
    params
  );

  return rows;
}

/**
 * 5. Get Doctor Prescriptions
 */
async function getDoctorPrescriptions(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { status, search } = query;

  const conditions = ['po.doctor_id = ?'];
  const params = [doctor.id];

  if (status && status !== 'all') {
    conditions.push('po.status = ?');
    params.push(status);
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR po.prescription_number LIKE ? OR po.diagnosis LIKE ?)');
    params.push(s, s, s, s, s);
  }

  const [prescriptions] = await db.query(
    `SELECT 
      po.id, po.prescription_number, po.patient_id, po.record_id, po.appointment_id, po.prescription_date, po.status,
      po.diagnosis, po.doctor_notes, po.patient_advice, po.is_locked, po.created_at,
      p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.allergies
     FROM prescription_orders po
     JOIN patients p ON po.patient_id = p.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY po.created_at DESC`,
    params
  );

  for (const rx of prescriptions) {
    const [items] = await db.query(
      `SELECT pi.*, m.form as dosage_form, m.strength
       FROM prescription_items pi
       LEFT JOIN medicines m ON pi.medicine_id = m.id
       WHERE pi.prescription_id = ?`,
      [rx.id]
    );
    rx.items = items;
  }

  return prescriptions;
}

/**
 * 6. Get Doctor Lab Orders & Requisitions
 */
async function getDoctorLabOrders(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { status, search } = query;

  const conditions = ['lo.doctor_id = ?'];
  const params = [doctor.id];

  if (status && status !== 'all') {
    conditions.push('lo.status = ?');
    params.push(status);
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR lo.order_number LIKE ?)');
    params.push(s, s, s, s);
  }

  const [orders] = await db.query(
    `SELECT 
      lo.id, lo.order_number, lo.patient_id, lo.record_id, lo.appointment_id, lo.order_date, lo.priority,
      lo.clinical_notes, lo.status, lo.total_price, lo.completed_at, lo.verified_at, lo.created_at,
      p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone
     FROM lab_orders lo
     JOIN patients p ON lo.patient_id = p.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY lo.order_date DESC, lo.id DESC`,
    params
  );

  for (const order of orders) {
    const [items] = await db.query(
      `SELECT loi.*, lt.name as test_name, lt.code as test_code, lt.category, lt.normal_range, lt.unit
       FROM lab_order_items loi
       LEFT JOIN lab_tests lt ON loi.test_id = lt.id
       WHERE loi.order_id = ?`,
      [order.id]
    );

    const [results] = await db.query(
      `SELECT lr.*, loi.test_name
       FROM lab_results lr
       LEFT JOIN lab_order_items loi ON lr.order_item_id = loi.id
       WHERE lr.order_id = ?`,
      [order.id]
    );

    order.items = items;
    order.results = results;
  }

  return orders;
}

/**
 * 7. Get Doctor Follow-ups Roster
 */
async function getDoctorFollowUps(user, query = {}) {
  const doctor = await getDoctorIdFromUser(user);
  const { filter = 'all', search } = query;

  const conditions = [
    'mr.doctor_id = ?',
    'mr.follow_up_date IS NOT NULL'
  ];
  const params = [doctor.id];

  if (filter === 'today') {
    conditions.push('mr.follow_up_date = CURDATE()');
  } else if (filter === 'this_week') {
    conditions.push('mr.follow_up_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)');
  } else if (filter === 'overdue') {
    conditions.push('mr.follow_up_date < CURDATE()');
  } else if (filter === 'upcoming') {
    conditions.push('mr.follow_up_date >= CURDATE()');
  }

  if (search && search.trim().length > 0) {
    const s = `%${search.trim()}%`;
    conditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR mr.diagnosis LIKE ?)');
    params.push(s, s, s, s);
  }

  const [rows] = await db.query(
    `SELECT 
      mr.id as record_id, mr.patient_id, mr.diagnosis, mr.treatment_plan, mr.clinical_notes, mr.follow_up_date,
      mr.record_date as initial_visit_date,
      p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.phone, p.blood_group, p.allergies,
      DATEDIFF(mr.follow_up_date, CURDATE()) as days_difference
     FROM medical_records mr
     JOIN patients p ON mr.patient_id = p.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY mr.follow_up_date ASC`,
    params
  );

  return rows;
}

/**
 * 8. Get Doctor Full Profile
 */
async function getDoctorProfile(user) {
  const doctor = await getDoctorIdFromUser(user);
  return doctor;
}

/**
 * 9. Update Doctor Profile (Self-Service)
 */
async function updateDoctorProfile(user, data) {
  const doctor = await getDoctorIdFromUser(user);

  const phone = data.phone !== undefined ? data.phone.trim() : doctor.phone;
  const bio = data.bio !== undefined ? data.bio.trim() : doctor.bio;
  const roomNumber = data.room_number !== undefined ? data.room_number.trim() : doctor.room_number;
  const consultationFee = data.consultation_fee !== undefined ? parseFloat(data.consultation_fee) : doctor.consultation_fee;
  const isAvailable = data.is_available !== undefined ? (data.is_available ? 1 : 0) : doctor.is_available;

  await db.query(
    `UPDATE users SET phone = ?, updated_at = NOW() WHERE id = ?`,
    [phone, doctor.user_id]
  );

  await db.query(
    `UPDATE doctors SET 
      bio = ?, 
      room_number = ?, 
      consultation_fee = ?, 
      is_available = ?, 
      updated_at = NOW() 
     WHERE id = ?`,
    [bio, roomNumber, consultationFee, isAvailable, doctor.id]
  );

  return {
    ...doctor,
    phone,
    bio,
    room_number: roomNumber,
    consultation_fee: consultationFee,
    is_available: isAvailable,
    message: 'Physician profile details updated successfully.'
  };
}

/**
 * 10. Get Doctor Weekly Schedule & Leaves
 */
async function getDoctorSchedule(user) {
  const doctor = await getDoctorIdFromUser(user);

  const [schedules] = await db.query(
    `SELECT * FROM doctor_schedules 
     WHERE doctor_id = ? 
     ORDER BY FIELD(day_of_week, 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')`,
    [doctor.id]
  );

  const [leaves] = await db.query(
    `SELECT * FROM doctor_leaves 
     WHERE doctor_id = ? 
     ORDER BY start_date DESC`,
    [doctor.id]
  );

  return {
    doctor: {
      id: doctor.id,
      name: doctor.name,
      doctor_code: doctor.doctor_code,
      department_name: doctor.department_name
    },
    schedules,
    leaves
  };
}

/**
 * 11. Update Doctor Schedule Slots
 */
async function updateDoctorSchedule(user, schedulesList) {
  const doctor = await getDoctorIdFromUser(user);

  if (!Array.isArray(schedulesList)) {
    throw new BadRequestError('Schedules must be provided as an array.');
  }

  for (const s of schedulesList) {
    if (!s.day_of_week || !s.start_time || !s.end_time) continue;

    await db.query(
      `INSERT INTO doctor_schedules 
        (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_patients, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
        start_time = VALUES(start_time), 
        end_time = VALUES(end_time), 
        slot_duration_minutes = VALUES(slot_duration_minutes), 
        max_patients = VALUES(max_patients), 
        is_active = VALUES(is_active)`,
      [
        doctor.id,
        s.day_of_week,
        s.start_time,
        s.end_time,
        parseInt(s.slot_duration_minutes, 10) || 20,
        parseInt(s.max_patients, 10) || 20,
        s.is_active !== undefined ? (s.is_active ? 1 : 0) : 1
      ]
    );
  }

  return getDoctorSchedule(user);
}

/**
 * 12. Submit Doctor Leave Request
 */
async function submitDoctorLeave(user, leaveData) {
  const doctor = await getDoctorIdFromUser(user);
  const { start_date, end_date, leave_type = 'annual', reason = 'Personal leave' } = leaveData;

  if (!start_date || !end_date) {
    throw new BadRequestError('Start date and end date are required.');
  }

  const [res] = await db.query(
    `INSERT INTO doctor_leaves 
      (doctor_id, start_date, end_date, leave_type, reason, is_full_day, status, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 'pending', NOW())`,
    [doctor.id, start_date, end_date, leave_type, reason]
  );

  return {
    id: res.insertId,
    doctor_id: doctor.id,
    start_date,
    end_date,
    leave_type,
    status: 'pending',
    message: 'Leave request submitted for administrative approval.'
  };
}

module.exports = {
  getDoctorIdFromUser,
  getDoctorDashboardOverview,
  getDoctorAppointments,
  getDoctorPatients,
  getDoctorConsultations,
  getDoctorPrescriptions,
  getDoctorLabOrders,
  getDoctorFollowUps,
  getDoctorProfile,
  updateDoctorProfile,
  getDoctorSchedule,
  updateDoctorSchedule,
  submitDoctorLeave
};
