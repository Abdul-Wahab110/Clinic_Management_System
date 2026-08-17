const http = require('http');
const { pool } = require('../server/config/db');

const TEST_PORT = parseInt(process.env.PORT || '5000', 10);

function sendReq(method, path, payload = null, token = null) {
  return new Promise((resolve) => {
    const postData = payload ? JSON.stringify(payload) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: path,
      method: method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✅ PASS: ${message}`);
}

async function runComprehensivePersistenceTests() {
  console.log('=========================================================================');
  console.log('🏛️ COMPREHENSIVE MYSQL DATABASE PERSISTENCE & DATA INTEGRITY TEST SUITE');
  console.log('=========================================================================\n');

  let adminToken, doctorToken, patientToken, pharmacistToken;

  // ----------------------------------------------------
  // 0. Authenticate Actors
  // ----------------------------------------------------
  console.log('--- Step 0: Authenticating Personas ---');
  const adminAuth = await sendReq('POST', '/api/v1/auth/login', { email: 'superadmin@auracare.com', password: 'Clinic2026!' });
  assert(adminAuth.status === 200, 'Super Admin authenticated');
  adminToken = adminAuth.data.data.token;

  const docAuth = await sendReq('POST', '/api/v1/auth/login', { email: 'marcus.vance@auracare.com', password: 'Clinic2026!' });
  assert(docAuth.status === 200, 'Physician authenticated');
  doctorToken = docAuth.data.data.token;

  const pharmAuth = await sendReq('POST', '/api/v1/auth/login', { email: 'pharmacy@auracare.com', password: 'Clinic2026!' });
  assert(pharmAuth.status === 200, 'Pharmacist authenticated');
  pharmacistToken = pharmAuth.data.data.token;

  // ----------------------------------------------------
  // 1. PATIENT MUTATIONS & PERSISTENCE
  // ----------------------------------------------------
  console.log('\n--- 1. Testing Patient CRUD & MySQL Persistence ---');
  const randNum = Math.floor(Math.random() * 900000) + 100000;
  const newPatientEmail = `persist.patient.${randNum}@example.com`;

  // 1a. Register Patient
  const regRes = await sendReq('POST', '/api/v1/auth/register', {
    full_name: `Persist Patient ${randNum}`,
    email: newPatientEmail,
    phone: '03001234567',
    gender: 'Female',
    date_of_birth: '1995-04-12',
    blood_group: 'B+',
    address: '77 Healthcare Boulevard, Sector G-11, Islamabad',
    password: 'PatientPassword2026!'
  });
  assert(regRes.status === 201, 'Patient registration API returned HTTP 201');
  const createdPatientId = regRes.data.data.user?.patientId || regRes.data.data.patient?.id || regRes.data.data.user?.id;
  assert(!!createdPatientId, `Patient created with ID: ${createdPatientId}`);

  // 1b. Verify MySQL users and patients rows exist
  const [[dbPatUser]] = await pool.query('SELECT id, email, full_name FROM users WHERE email = ?', [newPatientEmail]);
  assert(!!dbPatUser && dbPatUser.email === newPatientEmail, 'MySQL users table persisted new patient user');

  const [[dbPatRow]] = await pool.query('SELECT * FROM patients WHERE user_id = ?', [dbPatUser.id]);
  assert(!!dbPatRow && dbPatRow.blood_group === 'B+', 'MySQL patients table persisted patient record');

  // 1c. Edit Patient
  const editPatRes = await sendReq('PUT', `/api/v1/patients/${dbPatRow.id}`, {
    first_name: `PersistUpdated`,
    last_name: `${randNum}`,
    phone: '03009876543',
    blood_group: 'AB+',
    address: '88 New Address Avenue, Lahore'
  }, adminToken);
  assert(editPatRes.status === 200, 'PUT /patients/:id returned HTTP 200');

  const [[dbPatUpdated]] = await pool.query('SELECT blood_group, address FROM patients WHERE id = ?', [dbPatRow.id]);
  assert(dbPatUpdated.blood_group === 'AB+', 'MySQL patients table persisted updated blood_group');
  assert(dbPatUpdated.address.includes('88 New Address'), 'MySQL patients table persisted updated address');

  // ----------------------------------------------------
  // 2. APPOINTMENT LIFECYCLE & PERSISTENCE
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Appointment Lifecycle & MySQL Persistence ---');
  
  // 2a. Book Appointment (Pending)
  const apptDay = Math.floor(Math.random() * 18) + 10;
  const apptHour = Math.floor(Math.random() * 6) + 9;
  const apptDateStr = `2026-11-${apptDay}`;
  const apptStartTime = `${apptHour < 10 ? '0' + apptHour : apptHour}:${Math.random() > 0.5 ? '00' : '30'}:00`;

  const apptRes = await sendReq('POST', '/api/v1/appointments', {
    patient_id: dbPatRow.id,
    doctor_id: 1,
    department_id: 1,
    appointment_date: apptDateStr,
    start_time: apptStartTime,
    end_time: `${apptHour < 10 ? '0' + apptHour : apptHour}:45:00`,
    reason: 'Cardiology routine evaluation and persistence verification',
    appointment_type: 'in_person'
  }, adminToken);
  assert(apptRes.status === 201, `POST /appointments returned HTTP 201 (got ${apptRes.status})`);
  const apptId = apptRes.data.data.id;

  const [[dbApptPending]] = await pool.query('SELECT * FROM appointments WHERE id = ?', [apptId]);
  assert(['pending', 'scheduled', 'confirmed'].includes(dbApptPending.status), `MySQL appointments table persisted record with status: ${dbApptPending.status}`);

  // 2b. Approve / Confirm Appointment
  const approveRes = await sendReq('POST', `/api/v1/appointments/${apptId}/approve`, {}, doctorToken);
  assert(approveRes.status === 200, 'POST /appointments/:id/approve returned HTTP 200');

  const [[dbApptApproved]] = await pool.query('SELECT status FROM appointments WHERE id = ?', [apptId]);
  assert(dbApptApproved.status === 'confirmed', 'MySQL appointments table persisted status = confirmed');

  // 2c. Reschedule Appointment
  const reschedRes = await sendReq('PATCH', `/api/v1/appointments/${apptId}/reschedule`, {
    appointment_date: '2026-09-20',
    appointment_time: '14:00:00',
    reason: 'Patient rescheduled due to work trip'
  }, adminToken);
  assert(reschedRes.status === 200, 'PATCH /appointments/:id/reschedule returned HTTP 200');

  const [[dbApptResched]] = await pool.query('SELECT appointment_date FROM appointments WHERE id = ?', [apptId]);
  const reschedDate = new Date(dbApptResched.appointment_date).toISOString().slice(0, 10);
  assert(reschedDate === '2026-09-20', 'MySQL appointments table persisted rescheduled date 2026-09-20');

  // 2d. Cancel Appointment
  const cancelRes = await sendReq('PATCH', `/api/v1/appointments/${apptId}/status`, {
    status: 'cancelled',
    cancellation_reason: 'Patient requested date change / schedule conflict'
  }, adminToken);
  assert(cancelRes.status === 200, 'PATCH /appointments/:id/status (cancel) returned HTTP 200');

  const [[dbApptRejected]] = await pool.query('SELECT status, notes FROM appointments WHERE id = ?', [apptId]);
  assert(dbApptRejected.status === 'cancelled', 'MySQL appointments table persisted status = cancelled');

  // ----------------------------------------------------
  // 3. PRESCRIPTION & PHARMACY DISPENSING
  // ----------------------------------------------------
  console.log('\n--- 3. Testing Prescription, Pharmacy Dispensing & Stock Persistence ---');
  
  // 3a. Create Prescription Order
  const rxRes = await sendReq('POST', '/api/v1/prescriptions', {
    patient_id: dbPatRow.id,
    doctor_id: 1,
    diagnosis: 'Hypertensive Heart Disease',
    notes: 'Take with morning meals.',
    items: [
      { medicine_name: 'Lipitor (Atorvastatin)', dosage: '20mg', frequency: 'Once Daily', duration: '30 Days', instructions: 'Oral after breakfast' }
    ]
  }, doctorToken);
  assert(rxRes.status === 201, 'POST /prescriptions returned HTTP 201');
  const rxId = rxRes.data.data.id;

  const [[dbRxOrder]] = await pool.query('SELECT * FROM prescription_orders WHERE id = ?', [rxId]);
  assert(!!dbRxOrder, 'MySQL prescription_orders table persisted e-Rx record');
  assert(dbRxOrder.diagnosis === 'Hypertensive Heart Disease', 'MySQL persisted prescription diagnosis');

  // 3b. Pharmacy Dispensing & Atomic Stock Decrement
  const [[initialMed]] = await pool.query("SELECT id, stock_quantity FROM medicines WHERE name LIKE '%Lipitor%' LIMIT 1");
  const initialStock = initialMed.stock_quantity;

  const dispenseRes = await sendReq('POST', `/api/v1/pharmacy/dispense`, {
    prescription_id: rxId,
    items: [
      { medicine_id: initialMed.id, quantity: 30 }
    ],
    notes: 'Dispensed 30 tablets to patient.'
  }, pharmacistToken);
  assert(dispenseRes.status === 200 || dispenseRes.status === 201, 'POST /pharmacy/dispense returned HTTP 200/201');

  const [[updatedMed]] = await pool.query('SELECT stock_quantity FROM medicines WHERE id = ?', [initialMed.id]);
  assert(updatedMed.stock_quantity === initialStock - 30, `MySQL medicines table atomic stock deduction persisted: ${initialStock} -> ${updatedMed.stock_quantity}`);

  const [[dbRxDispensed]] = await pool.query('SELECT status FROM prescription_orders WHERE id = ?', [rxId]);
  assert(dbRxDispensed.status === 'dispensed', 'MySQL prescription_orders table persisted status = dispensed');

  // ----------------------------------------------------
  // 4. DIAGNOSTIC LAB WORKFLOW & PERSISTENCE
  // ----------------------------------------------------
  console.log('\n--- 4. Testing Diagnostic Lab Orders & Results Persistence ---');
  
  // 4a. Create Lab Order
  const labRes = await sendReq('POST', '/api/v1/lab/orders', {
    patient_id: dbPatRow.id,
    doctor_id: 1,
    test_ids: [1, 2],
    priority: 'urgent',
    clinical_notes: 'Check serum potassium and lipid profile'
  }, doctorToken);
  assert(labRes.status === 201, 'POST /lab/orders returned HTTP 201');
  const labOrderId = labRes.data.data.id;

  const [[dbLabOrder]] = await pool.query('SELECT * FROM lab_orders WHERE id = ?', [labOrderId]);
  assert(dbLabOrder.status === 'ordered', 'MySQL lab_orders table persisted status = ordered');

  // 4b. Collect Sample
  const sampleRes = await sendReq('PATCH', `/api/v1/lab/orders/${labOrderId}/status`, {
    status: 'sample_collected',
    sample_type: 'Venous Blood'
  }, adminToken);
  assert(sampleRes.status === 200, 'PATCH /lab/orders/:id/status returned HTTP 200');

  const [[dbLabSample]] = await pool.query('SELECT status, sample_type FROM lab_orders WHERE id = ?', [labOrderId]);
  assert(dbLabSample.status === 'sample_collected', 'MySQL lab_orders table persisted status = sample_collected');

  // 4c. Enter Results & Verification
  const resultRes = await sendReq('POST', `/api/v1/lab/orders/${labOrderId}/results`, {
    status: 'completed',
    result_notes: 'All metabolic parameters within normal ranges.',
    results: [
      { parameter_name: 'Fasting Blood Glucose', result_value: '94', unit: 'mg/dL', reference_range: '70 - 99', flag: 'normal' }
    ]
  }, adminToken);
  assert(resultRes.status === 200, 'POST /lab/orders/:id/results returned HTTP 200');

  const verifyRes = await sendReq('PATCH', `/api/v1/lab/orders/${labOrderId}/verify`, {}, adminToken);
  assert(verifyRes.status === 200, 'PATCH /lab/orders/:id/verify returned HTTP 200');

  const [[dbLabVerified]] = await pool.query('SELECT status FROM lab_orders WHERE id = ?', [labOrderId]);
  assert(dbLabVerified.status === 'verified', 'MySQL lab_orders table persisted status = verified');

  // ----------------------------------------------------
  // 5. BILLING, PAYMENTS & FINANCIAL PERSISTENCE
  // ----------------------------------------------------
  console.log('\n--- 5. Testing Invoices, Payments & Financial Ledger Persistence ---');
  
  // 5a. Create Invoice
  const invRes = await sendReq('POST', '/api/v1/billing/invoices', {
    patient_id: dbPatRow.id,
    doctor_id: 1,
    department_id: 1,
    discount_type: 'fixed',
    discount_rate: 50.00,
    tax_rate: 5.00,
    billing_notes: 'Cardiology consultation and diagnostic laboratory tests',
    items: [
      { item_name: 'Cardiology Specialist Consultation', service_type: 'consultation', quantity: 1, unit_price: 300.00 },
      { item_name: 'Diagnostic Laboratory Panel', service_type: 'laboratory', quantity: 1, unit_price: 200.00 }
    ]
  }, adminToken);
  assert(invRes.status === 201, 'POST /billing/invoices returned HTTP 201');
  const invoiceId = invRes.data.data.id;

  const [[dbInv]] = await pool.query('SELECT * FROM invoices WHERE id = ?', [invoiceId]);
  const expectedTotal = parseFloat(dbInv.net_amount || dbInv.total_amount);
  assert(expectedTotal > 0, `MySQL invoices table persisted total invoice amount: $${expectedTotal}`);
  assert(dbInv.status === 'issued' || dbInv.status === 'unpaid', `MySQL invoices table persisted status = ${dbInv.status}`);

  // 5b. Record Partial Payment
  const partialPaymentAmount = 200.00;
  const partPayRes = await sendReq('POST', '/api/v1/billing/payments', {
    invoice_id: invoiceId,
    patient_id: dbPatRow.id,
    amount_paid: partialPaymentAmount,
    payment_method: 'credit_card',
    transaction_ref: `TXN-${Date.now()}`
  }, adminToken);
  assert(partPayRes.status === 201 || partPayRes.status === 200, 'POST /billing/payments (Partial) returned HTTP 200/201');

  const [[dbInvPart]] = await pool.query('SELECT paid_amount, remaining_amount, status FROM invoices WHERE id = ?', [invoiceId]);
  assert(parseFloat(dbInvPart.paid_amount) === partialPaymentAmount, `MySQL invoices table persisted paid_amount = $${partialPaymentAmount}`);
  assert(dbInvPart.status === 'partially_paid', 'MySQL invoices table persisted status = partially_paid');

  // 5c. Record Balance Payment
  const remainingDue = parseFloat(dbInvPart.remaining_amount);
  const fullPayRes = await sendReq('POST', '/api/v1/billing/payments', {
    invoice_id: invoiceId,
    patient_id: dbPatRow.id,
    amount_paid: remainingDue,
    payment_method: 'cash',
    transaction_ref: `TXN-FULL-${Date.now()}`
  }, adminToken);
  assert(fullPayRes.status === 201 || fullPayRes.status === 200, 'POST /billing/payments (Full) returned HTTP 200/201');

  const [[dbInvFull]] = await pool.query('SELECT paid_amount, remaining_amount, status FROM invoices WHERE id = ?', [invoiceId]);
  assert(parseFloat(dbInvFull.remaining_amount) === 0.00, 'MySQL invoices table persisted remaining_amount = $0.00');
  assert(dbInvFull.status === 'paid', 'MySQL invoices table persisted status = paid');

  // ----------------------------------------------------
  // 6. IPD ADMISSION, BED OCCUPANCY & DISCHARGE
  // ----------------------------------------------------
  console.log('\n--- 6. Testing IPD Inpatient Admission, Bed Allocation & Discharge Persistence ---');
  
  // 6a. Find Available Bed
  const [[availBed]] = await pool.query("SELECT id, bed_number, ward_id, room_id FROM beds WHERE status = 'available' LIMIT 1");
  assert(!!availBed, `Found available bed: ${availBed.bed_number}`);

  // 6b. Create IPD Admission
  const admitRes = await sendReq('POST', '/api/v1/ipd/admissions', {
    patient_id: dbPatRow.id,
    doctor_id: 1,
    department_id: 1,
    ward_id: availBed.ward_id || 1,
    room_id: availBed.room_id || 1,
    bed_id: availBed.id,
    admission_type: 'emergency',
    admitting_diagnosis: 'Acute Coronary Syndrome - Stabilized & Monitored',
    chief_complaint: 'Substernal chest pressure'
  }, adminToken);
  assert(admitRes.status === 201 || admitRes.status === 200, 'POST /ipd/admissions returned HTTP 200/201');
  const admissionId = admitRes.data.data.id;

  const [[dbAdmit]] = await pool.query('SELECT * FROM ipd_admissions WHERE id = ?', [admissionId]);
  assert(dbAdmit.status === 'admitted', 'MySQL ipd_admissions table persisted status = admitted');

  const [[dbBedOccupied]] = await pool.query('SELECT status FROM beds WHERE id = ?', [availBed.id]);
  assert(dbBedOccupied.status === 'occupied', 'MySQL beds table persisted status = occupied');

  // 6c. Clinical Discharge
  const dischargeRes = await sendReq('POST', `/api/v1/ipd/admissions/${admissionId}/discharge`, {
    final_diagnosis: 'Acute Coronary Syndrome - Fully Resolved',
    discharge_summary: 'Patient successfully recovered, vital signs normalized, and cleared for home discharge.',
    discharge_condition: 'Stable & Ambulatory'
  }, adminToken);
  assert(dischargeRes.status === 200, 'POST /ipd/admissions/:id/discharge returned HTTP 200');

  const [[dbAdmitDischarged]] = await pool.query('SELECT status FROM ipd_admissions WHERE id = ?', [admissionId]);
  assert(dbAdmitDischarged.status === 'discharged', 'MySQL ipd_admissions table persisted status = discharged');

  const [[dbBedReleased]] = await pool.query('SELECT status FROM beds WHERE id = ?', [availBed.id]);
  assert(['available', 'cleaning'].includes(dbBedReleased.status), `MySQL beds table released bed to status = ${dbBedReleased.status}`);

  // ----------------------------------------------------
  // 7. RBAC MATRIX PERSISTENCE
  // ----------------------------------------------------
  console.log('\n--- 7. Testing RBAC Permission Matrix Persistence ---');
  
  const [docPerms] = await pool.query(`SELECT id FROM permissions WHERE module IN ('appointments', 'patients', 'medical_records', 'prescriptions', 'lab')`);
  const docPermIds = docPerms.map(p => p.id);

  // Toggle permission for Doctor role
  const matrixRes = await sendReq('PUT', '/api/v1/admin/matrix', {
    assignments: {
      3: docPermIds // Doctor
    }
  }, adminToken);
  assert(matrixRes.status === 200, 'PUT /admin/matrix returned HTTP 200');

  const [dbRolePerms] = await pool.query('SELECT COUNT(*) as c FROM role_permissions WHERE role_id = 3');
  assert(dbRolePerms[0].c === docPermIds.length, `MySQL role_permissions table persisted updated doctor permissions count = ${docPermIds.length}`);

  // ----------------------------------------------------
  // 8. NOTIFICATIONS & SECURITY AUDIT LOGS
  // ----------------------------------------------------
  console.log('\n--- 8. Testing Notifications & Audit Log Ingestion ---');
  
  // 8a. Create Notification
  const notifRes = await sendReq('POST', '/api/v1/notifications', {
    user_id: dbPatUser.id,
    title: 'Persistence Test Notification',
    message: 'Your hospital records have been successfully verified and backed by MySQL.',
    notification_type: 'system_notification',
    priority: 'normal'
  }, adminToken);
  assert(notifRes.status === 201, 'POST /notifications returned HTTP 201');
  const notifId = notifRes.data.data.id;

  const [[dbNotif]] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notifId]);
  assert(dbNotif.is_read === 0, 'MySQL notifications table persisted unread notification');

  // 8b. Mark Notification as Read
  const readRes = await sendReq('PATCH', `/api/v1/notifications/${notifId}/read`, {}, adminToken);
  assert(readRes.status === 200, 'PATCH /notifications/:id/read returned HTTP 200');

  const [[dbNotifRead]] = await pool.query('SELECT is_read FROM notifications WHERE id = ?', [notifId]);
  assert(dbNotifRead.is_read === 1, 'MySQL notifications table persisted is_read = 1');

  // 8c. Verify Security Audit Trail
  const [auditRows] = await pool.query('SELECT action, entity, user_id FROM audit_logs ORDER BY id DESC LIMIT 5');
  assert(auditRows.length > 0, 'MySQL audit_logs table actively records system actions');
  console.log(`    Latest audit action in MySQL: [${auditRows[0].action}] on entity [${auditRows[0].entity}]`);

  console.log('\n=========================================================================');
  console.log('🏁 ALL DATABASE PERSISTENCE & DATA INTEGRITY TESTS PASSED (0 FAILURES)');
  console.log('=========================================================================\n');
  process.exit(0);
}

runComprehensivePersistenceTests().catch(err => {
  console.error('Persistence Test Error:', err);
  process.exit(1);
});
