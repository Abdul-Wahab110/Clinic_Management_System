const db = require('../config/db');
const { ForbiddenError, BadRequestError } = require('../utils/errors');

/**
 * Helper to resolve patient ID for authenticated patient user
 */
async function getPatientIdForUser(userId) {
  const [rows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [userId]);
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Helper to resolve doctor ID for authenticated doctor user
 */
async function getDoctorIdForUser(userId) {
  const [rows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Secure Global Search Engine
 * Respects strict Role-Based Access Controls (RBAC) and data confidentiality.
 */
async function globalSearch(user, queryParams = {}) {
  const rawQuery = (queryParams.q || queryParams.search || '').trim();
  const category = (queryParams.category || 'all').toLowerCase();
  const limitPerCategory = Math.min(Math.max(parseInt(queryParams.limit, 10) || 6, 1), 25);

  // Return empty result set if search term is shorter than 2 characters
  if (rawQuery.length < 2) {
    return {
      query: rawQuery,
      total_matches: 0,
      categories: {
        patients: [],
        doctors: [],
        appointments: [],
        prescriptions: [],
        lab_tests: [],
        invoices: [],
        medicines: []
      }
    };
  }

  const role = user ? user.role : 'guest';
  const searchTerm = `%${rawQuery}%`;

  const results = {
    query: rawQuery,
    total_matches: 0,
    categories: {}
  };

  // Resolve user context
  let userPatientId = null;
  let userDoctorId = null;
  if (role === 'patient') {
    userPatientId = await getPatientIdForUser(user.id);
  } else if (role === 'doctor') {
    userDoctorId = await getDoctorIdForUser(user.id);
  }

  // =========================================================================
  // 1. PATIENTS SEARCH
  // =========================================================================
  // Patients cannot search other patients (privacy protection).
  const canSearchPatients = ['super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'pharmacist', 'lab_technician'].includes(role);
  
  if (canSearchPatients && (category === 'all' || category === 'patients')) {
    const [rows] = await db.query(
      `SELECT 
        p.id, p.patient_code, p.first_name, p.last_name, p.gender, p.date_of_birth, p.blood_group,
        p.phone, p.email, p.allergies, p.status, p.created_at
       FROM patients p
       WHERE (p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)
       ORDER BY p.last_name ASC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, limitPerCategory]
    );

    // Redact sensitive medical fields for administrative/billing staff
    if (['receptionist', 'accountant'].includes(role)) {
      rows.forEach(r => { delete r.allergies; });
    }

    results.categories.patients = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.patients = [];
  }

  // =========================================================================
  // 2. DOCTORS SEARCH
  // =========================================================================
  // All authenticated users can search hospital doctors
  if (category === 'all' || category === 'doctors') {
    const [rows] = await db.query(
      `SELECT 
        doc.id, doc.doctor_code, u.full_name as name, u.email, doc.specialization,
        doc.qualification, doc.room_number, doc.consultation_fee, doc.is_available,
        dept.name as department_name, dept.code as department_code
       FROM doctors doc
       JOIN users u ON doc.user_id = u.id
       LEFT JOIN departments dept ON doc.department_id = dept.id
       WHERE (u.full_name LIKE ? OR doc.specialization LIKE ? OR doc.doctor_code LIKE ? OR dept.name LIKE ?)
         AND doc.status = 'active'
       ORDER BY u.full_name ASC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, searchTerm, limitPerCategory]
    );
    results.categories.doctors = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.doctors = [];
  }

  // =========================================================================
  // 3. APPOINTMENTS SEARCH
  // =========================================================================
  const canSearchAppts = ['super_admin', 'hospital_admin', 'doctor', 'nurse', 'receptionist', 'accountant', 'patient'].includes(role);

  if (canSearchAppts && (category === 'all' || category === 'appointments')) {
    let whereClause = '(a.appointment_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR u.full_name LIKE ? OR a.reason LIKE ?)';
    const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

    if (role === 'patient') {
      if (userPatientId) {
        whereClause += ' AND a.patient_id = ?';
        params.push(userPatientId);
      } else {
        whereClause += ' AND 1=0';
      }
    } else if (role === 'doctor' && userDoctorId) {
      whereClause += ' AND (a.doctor_id = ? OR a.department_id = (SELECT department_id FROM doctors WHERE id = ?))';
      params.push(userDoctorId, userDoctorId);
    }

    params.push(limitPerCategory);

    const [rows] = await db.query(
      `SELECT 
        a.id, a.appointment_number, a.appointment_date, a.appointment_time, a.type, a.status, a.reason,
        p.id as patient_id, p.first_name, p.last_name, p.patient_code,
        d.name as department_name,
        u.full_name as doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN departments d ON a.department_id = d.id
       LEFT JOIN doctors doc ON a.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       WHERE ${whereClause}
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT ?`,
      params
    );
    results.categories.appointments = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.appointments = [];
  }

  // =========================================================================
  // 4. PRESCRIPTIONS SEARCH
  // =========================================================================
  const canSearchRx = ['super_admin', 'hospital_admin', 'doctor', 'nurse', 'pharmacist', 'patient'].includes(role);

  if (canSearchRx && (category === 'all' || category === 'prescriptions')) {
    let whereClause = `(po.prescription_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ? OR po.diagnosis LIKE ? OR EXISTS (
      SELECT 1 FROM prescription_items pi2 WHERE pi2.prescription_id = po.id AND (pi2.medicine_name LIKE ? OR pi2.generic_name LIKE ?)
    ))`;
    const params = [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm];

    if (role === 'patient') {
      if (userPatientId) {
        whereClause += ' AND po.patient_id = ?';
        params.push(userPatientId);
      } else {
        whereClause += ' AND 1=0';
      }
    } else if (role === 'doctor' && userDoctorId) {
      whereClause += ' AND (po.doctor_id = ? OR po.patient_id IN (SELECT patient_id FROM medical_records WHERE doctor_id = ?))';
      params.push(userDoctorId, userDoctorId);
    }

    params.push(limitPerCategory);

    const [rows] = await db.query(
      `SELECT 
        po.id, po.prescription_number, po.prescription_date, po.status, po.diagnosis, po.patient_advice,
        p.id as patient_id, p.first_name, p.last_name, p.patient_code,
        u.full_name as doctor_name,
        (SELECT GROUP_CONCAT(COALESCE(pi.medicine_name, m.name) SEPARATOR ', ')
         FROM prescription_items pi 
         LEFT JOIN medicines m ON pi.medicine_id = m.id 
         WHERE pi.prescription_id = po.id) as medicines_summary
       FROM prescription_orders po
       JOIN patients p ON po.patient_id = p.id
       LEFT JOIN doctors doc ON po.doctor_id = doc.id
       LEFT JOIN users u ON doc.user_id = u.id
       WHERE ${whereClause}
       ORDER BY po.created_at DESC
       LIMIT ?`,
      params
    );
    results.categories.prescriptions = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.prescriptions = [];
  }

  // =========================================================================
  // 5. LAB TESTS SEARCH (Catalog and Diagnostics)
  // =========================================================================
  if (category === 'all' || category === 'lab_tests') {
    const [rows] = await db.query(
      `SELECT 
        lt.id, lt.code, lt.name, lt.category, lt.sample_type, lt.price,
        lt.turnaround_hours, lt.normal_range, lt.unit, lt.is_active
       FROM lab_tests lt
       WHERE (lt.name LIKE ? OR lt.code LIKE ? OR lt.category LIKE ? OR lt.sample_type LIKE ?)
         AND lt.is_active = 1
       ORDER BY lt.name ASC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, searchTerm, limitPerCategory]
    );
    results.categories.lab_tests = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.lab_tests = [];
  }

  // =========================================================================
  // 6. INVOICES SEARCH
  // =========================================================================
  const canSearchInvoices = ['super_admin', 'hospital_admin', 'accountant', 'receptionist', 'patient'].includes(role);

  if (canSearchInvoices && (category === 'all' || category === 'invoices')) {
    let whereClause = '(i.invoice_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_code LIKE ?)';
    const params = [searchTerm, searchTerm, searchTerm, searchTerm];

    if (role === 'patient') {
      if (userPatientId) {
        whereClause += ' AND i.patient_id = ?';
        params.push(userPatientId);
      } else {
        whereClause += ' AND 1=0';
      }
    }

    params.push(limitPerCategory);

    const [rows] = await db.query(
      `SELECT 
        i.id, i.invoice_number, i.invoice_date, i.net_amount, i.paid_amount, i.remaining_amount, i.status,
        p.id as patient_id, p.first_name, p.last_name, p.patient_code
       FROM invoices i
       JOIN patients p ON i.patient_id = p.id
       WHERE ${whereClause}
       ORDER BY i.created_at DESC
       LIMIT ?`,
      params
    );
    results.categories.invoices = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.invoices = [];
  }

  // =========================================================================
  // 7. MEDICINES SEARCH (Pharmacy Formulary)
  // =========================================================================
  // All authenticated users can search the medication catalog
  if (category === 'all' || category === 'medicines') {
    const [rows] = await db.query(
      `SELECT 
        m.id, m.name, m.generic_name, m.category, m.form, m.strength,
        m.selling_price as unit_price, m.stock_quantity, m.min_stock_level,
        m.requires_prescription, m.manufacturer, m.location_shelf
       FROM medicines m
       WHERE (m.name LIKE ? OR m.generic_name LIKE ? OR m.category LIKE ? OR m.manufacturer LIKE ?)
         AND m.is_active = 1
       ORDER BY m.name ASC
       LIMIT ?`,
      [searchTerm, searchTerm, searchTerm, searchTerm, limitPerCategory]
    );

    // Hide internal stock counts & manufacturer shelf location from standard patients
    if (role === 'patient') {
      rows.forEach(r => {
        delete r.stock_quantity;
        delete r.min_stock_level;
        delete r.location_shelf;
      });
    }

    results.categories.medicines = rows;
    results.total_matches += rows.length;
  } else {
    results.categories.medicines = [];
  }

  return results;
}

module.exports = {
  globalSearch
};
