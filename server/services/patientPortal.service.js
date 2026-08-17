const db = require('../config/db');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');
const { createAuditLog } = require('./audit.service');

/**
 * Resolve Patient ID from Authenticated User
 */
async function getPatientIdFromUser(user) {
  if (!user) throw new ForbiddenError('Authentication required.');
  
  const [rows] = await db.query(
    `SELECT id, patient_code, first_name, last_name, email, phone, gender, date_of_birth, blood_group, allergies, 
            COALESCE(emergency_contact_phone, emergency_contact_name, '') as emergency_contact,
            emergency_contact_name, emergency_contact_phone, address 
     FROM patients 
     WHERE user_id = ? LIMIT 1`,
    [user.id]
  );

  if (rows.length === 0) {
    // If admin is testing/viewing, allow fallback to patient ID 1
    if (user.role === 'super_admin' || user.role === 'hospital_admin') {
      const [adminFallback] = await db.query('SELECT * FROM patients WHERE id = 1 LIMIT 1');
      if (adminFallback.length > 0) return adminFallback[0];
    }
    throw new NotFoundError('No clinical patient record is associated with this user account.');
  }

  return rows[0];
}

/**
 * 1. Comprehensive Patient Dashboard Overview (Real MySQL Data)
 */
async function getPatientDashboardOverview(user) {
  const patient = await getPatientIdFromUser(user);
  const patientId = patient.id;

  // 1. Upcoming Appointments
  const [upcomingAppointments] = await db.query(
    `SELECT 
      a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.type, a.status, a.reason,
      d.name as department_name, d.code as department_code,
      COALESCE(u.full_name, 'Attending Specialist') as doctor_name,
      doc.room_number, doc.consultation_fee
     FROM appointments a
     JOIN departments d ON a.department_id = d.id
     LEFT JOIN doctors doc ON a.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     WHERE a.patient_id = ? 
       AND a.status IN ('pending', 'confirmed', 'scheduled')
       AND a.appointment_date >= CURDATE()
     ORDER BY a.appointment_date ASC, a.appointment_time ASC
     LIMIT 5`,
    [patientId]
  );

  // 2. Recent Medical Encounters & Clinical Visits
  const [recentVisits] = await db.query(
    `SELECT 
      m.id, m.record_date, m.chief_complaint, m.diagnosis, m.clinical_notes, m.treatment_plan, m.follow_up_date,
      COALESCE(u.full_name, 'Attending Physician') as doctor_name,
      dept.name as department_name
     FROM medical_records m
     LEFT JOIN doctors doc ON m.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     WHERE m.patient_id = ?
     ORDER BY m.record_date DESC
     LIMIT 5`,
    [patientId]
  );

  // 3. Active Prescriptions (from prescription_orders)
  const [activePrescriptions] = await db.query(
    `SELECT 
      po.id, po.prescription_number, po.diagnosis, po.prescription_date, po.status, po.patient_advice as instructions, po.created_at,
      COALESCE(u.full_name, 'Prescribing Doctor') as doctor_name,
      (SELECT COUNT(*) FROM prescription_items WHERE prescription_id = po.id) as medicines_count
     FROM prescription_orders po
     LEFT JOIN doctors doc ON po.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     WHERE po.patient_id = ?
     ORDER BY po.created_at DESC
     LIMIT 5`,
    [patientId]
  );

  // 4. Recent Lab Reports & Diagnostic Orders
  const [recentLabReports] = await db.query(
    `SELECT 
      lo.id, lo.order_number, lo.order_date, lo.status, lo.clinical_notes,
      COALESCE(u.full_name, 'Ordering Clinician') as doctor_name,
      (SELECT COUNT(*) FROM lab_order_items WHERE order_id = lo.id) as tests_count
     FROM lab_orders lo
     LEFT JOIN doctors doc ON lo.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     WHERE lo.patient_id = ?
     ORDER BY lo.order_date DESC
     LIMIT 5`,
    [patientId]
  );

  // 5. Invoices & Outstanding Bills
  const [invoices] = await db.query(
    `SELECT 
      i.id, i.invoice_number, i.total_amount, i.discount_amount, i.tax_amount, i.net_amount, 
      i.status, i.due_date, i.created_at,
      COALESCE((SELECT SUM(amount_paid) FROM payments WHERE invoice_id = i.id AND status = 'completed'), 0) as paid_amount
     FROM invoices i
     WHERE i.patient_id = ?
     ORDER BY i.created_at DESC
     LIMIT 5`,
    [patientId]
  );

  // 6. Recent Payment Receipts
  const [recentPayments] = await db.query(
    `SELECT 
      p.id, p.receipt_number, p.amount_paid as amount, p.payment_method, p.status, p.payment_date, p.transaction_ref as transaction_reference,
      i.invoice_number
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.patient_id = ? AND p.status = 'completed'
     ORDER BY p.payment_date DESC
     LIMIT 5`,
    [patientId]
  );

  // 7. Recent Notifications for User
  const [notifications] = await db.query(
    `SELECT id, title, message, type, is_read, action_url, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 5`,
    [user.id]
  );

  // 8. Aggregated Financial Totals
  const [finTotals] = await db.query(
    `SELECT 
      COALESCE(SUM(net_amount), 0) as total_billed,
      COALESCE(SUM(CASE WHEN status != 'paid' THEN net_amount ELSE 0 END), 0) as outstanding_balance
     FROM invoices 
     WHERE patient_id = ?`,
    [patientId]
  );

  const [paidTotalRows] = await db.query(
    `SELECT COALESCE(SUM(p.amount_paid), 0) as total_paid
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.patient_id = ? AND p.status = 'completed'`,
    [patientId]
  );

  const totalBilled = parseFloat(finTotals[0].total_billed) || 0;
  const totalPaid = parseFloat(paidTotalRows[0].total_paid) || 0;
  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  return {
    patient: {
      id: patient.id,
      patient_code: patient.patient_code,
      name: `${patient.first_name} ${patient.last_name}`.trim(),
      email: patient.email,
      phone: patient.phone,
      blood_group: patient.blood_group,
      allergies: patient.allergies,
      emergency_contact: patient.emergency_contact
    },
    metrics: {
      upcoming_appointments_count: upcomingAppointments.length,
      active_prescriptions_count: activePrescriptions.length,
      pending_lab_reports_count: recentLabReports.filter(l => l.status === 'pending' || l.status === 'in_progress').length,
      outstanding_balance: outstandingBalance,
      total_visits_count: recentVisits.length
    },
    upcoming_appointments: upcomingAppointments,
    recent_visits: recentVisits,
    active_prescriptions: activePrescriptions,
    recent_lab_reports: recentLabReports,
    outstanding_invoices: invoices.filter(i => i.status !== 'paid'),
    all_recent_invoices: invoices,
    recent_payments: recentPayments,
    notifications: notifications
  };
}

/**
 * 2. Get Patient Appointments (Strictly Scoped to Authenticated Patient)
 */
async function getPatientAppointments(user, query = {}) {
  const patient = await getPatientIdFromUser(user);
  const { status, timeframe } = query;

  const conditions = ['a.patient_id = ?'];
  const params = [patient.id];

  if (status && status !== 'all') {
    conditions.push('a.status = ?');
    params.push(status);
  }

  if (timeframe === 'upcoming') {
    conditions.push('a.appointment_date >= CURDATE()');
    conditions.push("a.status IN ('pending', 'confirmed', 'scheduled')");
  } else if (timeframe === 'past') {
    conditions.push('(a.appointment_date < CURDATE() OR a.status IN (\'completed\', \'cancelled\'))');
  }

  const [rows] = await db.query(
    `SELECT 
      a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.type, a.status, a.reason,
      d.name as department_name, d.code as department_code,
      COALESCE(u.full_name, 'Attending Specialist') as doctor_name,
      doc.room_number, doc.consultation_fee, doc.id as doctor_id
     FROM appointments a
     JOIN departments d ON a.department_id = d.id
     LEFT JOIN doctors doc ON a.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
    params
  );

  return rows;
}

/**
 * 3. Book New Appointment by Patient (Self-Service)
 */
async function bookPatientAppointment(user, data) {
  const patient = await getPatientIdFromUser(user);
  const departmentId = parseInt(data.department_id, 10);
  const doctorId = data.doctor_id ? parseInt(data.doctor_id, 10) : null;
  const appointmentDate = data.appointment_date;
  const appointmentTime = data.appointment_time || '09:00:00';
  const reason = data.reason ? data.reason.trim() : 'Patient Consultation';
  const type = data.type || 'consultation';

  if (!departmentId || !appointmentDate) {
    throw new BadRequestError('Department and appointment date are required.');
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const appointmentNumber = `APT-2026-${randomSuffix}`;

  const [res] = await db.query(
    `INSERT INTO appointments 
     (appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NOW())`,
    [appointmentNumber, patient.id, doctorId, departmentId, appointmentDate, appointmentTime, type, reason]
  );

  // Non-blocking notification to patient
  try {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, action_url)
       VALUES (?, 'Appointment Confirmed', ?, 'appointment', '/patient/appointments')`,
      [user.id, `Your appointment (${appointmentNumber}) for ${appointmentDate} has been confirmed.`]
    );
  } catch (_) {}

  return {
    id: res.insertId,
    appointment_number: appointmentNumber,
    appointment_date: appointmentDate,
    appointment_time: appointmentTime,
    status: 'confirmed',
    message: 'Appointment booked successfully!'
  };
}

/**
 * 4. Cancel Appointment by Patient
 */
async function cancelPatientAppointment(user, appointmentId, reason = 'Cancelled by Patient') {
  const patient = await getPatientIdFromUser(user);

  const [rows] = await db.query(
    'SELECT id, appointment_number, status FROM appointments WHERE id = ? AND patient_id = ?',
    [appointmentId, patient.id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Appointment not found or unauthorized.');
  }

  await db.query(
    "UPDATE appointments SET status = 'cancelled', reason = CONCAT(COALESCE(reason, ''), ' [Cancelled by patient: ', ?, ']') WHERE id = ?",
    [reason, appointmentId]
  );

  return {
    id: appointmentId,
    status: 'cancelled',
    message: 'Appointment cancelled successfully.'
  };
}

/**
 * 5. Get Patient Medical History & Clinical Encounters
 */
async function getPatientMedicalHistory(user) {
  const patient = await getPatientIdFromUser(user);

  const [records] = await db.query(
    `SELECT 
      m.*,
      COALESCE(u.full_name, 'Attending Physician') as doctor_name,
      dept.name as department_name
     FROM medical_records m
     LEFT JOIN doctors doc ON m.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     WHERE m.patient_id = ?
     ORDER BY m.record_date DESC`,
    [patient.id]
  );

  const [vitals] = await db.query(
    `SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at DESC LIMIT 10`,
    [patient.id]
  );

  return {
    patient: {
      id: patient.id,
      patient_code: patient.patient_code,
      name: `${patient.first_name} ${patient.last_name}`,
      blood_group: patient.blood_group,
      allergies: patient.allergies
    },
    records,
    vitals
  };
}

/**
 * 6. Get Patient Prescriptions
 */
async function getPatientPrescriptions(user) {
  const patient = await getPatientIdFromUser(user);

  const [prescriptions] = await db.query(
    `SELECT 
      po.*,
      COALESCE(u.full_name, 'Attending Physician') as doctor_name,
      dept.name as department_name
     FROM prescription_orders po
     LEFT JOIN doctors doc ON po.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     WHERE po.patient_id = ?
     ORDER BY po.created_at DESC`,
    [patient.id]
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
 * 7. Get Patient Lab Reports & Diagnostics
 */
async function getPatientLabReports(user) {
  const patient = await getPatientIdFromUser(user);

  const [orders] = await db.query(
    `SELECT 
      lo.*,
      COALESCE(u.full_name, 'Ordering Clinician') as doctor_name,
      dept.name as department_name
     FROM lab_orders lo
     LEFT JOIN doctors doc ON lo.doctor_id = doc.id
     LEFT JOIN users u ON doc.user_id = u.id
     LEFT JOIN departments dept ON doc.department_id = dept.id
     WHERE lo.patient_id = ?
     ORDER BY lo.order_date DESC`,
    [patient.id]
  );

  for (const order of orders) {
    const [items] = await db.query(
      `SELECT loi.*, lt.name as test_name_ref, lt.code as test_code, lt.category, lt.normal_range, lt.unit
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
    order.tests = items;
    order.results = results;
  }

  return orders;
}

/**
 * 8. Get Patient Invoices & Billing Breakdown
 */
async function getPatientInvoices(user) {
  const patient = await getPatientIdFromUser(user);

  const [invoices] = await db.query(
    `SELECT 
      i.*,
      COALESCE((SELECT SUM(amount_paid) FROM payments WHERE invoice_id = i.id AND status = 'completed'), 0) as paid_amount
     FROM invoices i
     WHERE i.patient_id = ?
     ORDER BY i.created_at DESC`,
    [patient.id]
  );

  for (const inv of invoices) {
    const [items] = await db.query(
      `SELECT * FROM invoice_items WHERE invoice_id = ?`,
      [inv.id]
    );
    inv.items = items;
  }

  return invoices;
}

/**
 * 9. Get Patient Payments Ledger
 */
async function getPatientPayments(user) {
  const patient = await getPatientIdFromUser(user);

  const [payments] = await db.query(
    `SELECT 
      p.*,
      p.amount_paid as amount,
      p.transaction_ref as transaction_reference,
      i.invoice_number, i.total_amount, i.net_amount
     FROM payments p
     JOIN invoices i ON p.invoice_id = i.id
     WHERE i.patient_id = ?
     ORDER BY p.payment_date DESC`,
    [patient.id]
  );

  return payments;
}

/**
 * 10. Get Patient Documents
 */
async function getPatientDocuments(user) {
  const patient = await getPatientIdFromUser(user);

  const [documents] = await db.query(
    `SELECT pd.*, u.full_name as uploaded_by_name
     FROM patient_documents pd
     LEFT JOIN users u ON pd.uploaded_by = u.id
     WHERE pd.patient_id = ?
     ORDER BY pd.uploaded_at DESC`,
    [patient.id]
  );

  return documents;
}

/**
 * 11. Update Patient Demographic Profile
 */
async function updatePatientProfile(user, data) {
  const patient = await getPatientIdFromUser(user);

  const phone = data.phone !== undefined ? data.phone.trim() : patient.phone;
  const address = data.address !== undefined ? data.address.trim() : patient.address;
  const emergencyContactPhone = data.emergency_contact !== undefined ? data.emergency_contact.trim() : patient.emergency_contact_phone;
  const allergies = data.allergies !== undefined ? data.allergies.trim() : patient.allergies;

  await db.query(
    `UPDATE patients SET 
      phone = ?, 
      address = ?, 
      emergency_contact_phone = ?, 
      allergies = ?,
      updated_at = NOW()
     WHERE id = ?`,
    [phone, address, emergencyContactPhone, allergies, patient.id]
  );

  return {
    ...patient,
    phone,
    address,
    emergency_contact: emergencyContactPhone,
    emergency_contact_phone: emergencyContactPhone,
    allergies,
    message: 'Profile details updated successfully.'
  };
}

module.exports = {
  getPatientIdFromUser,
  getPatientDashboardOverview,
  getPatientAppointments,
  bookPatientAppointment,
  cancelPatientAppointment,
  getPatientMedicalHistory,
  getPatientPrescriptions,
  getPatientLabReports,
  getPatientInvoices,
  getPatientPayments,
  getPatientDocuments,
  updatePatientProfile
};

