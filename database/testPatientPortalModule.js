const http = require('http');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let patientToken = '';
let otherPatientToken = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function parseUrl(endpoint) {
  const url = new URL(BASE_URL + endpoint);
  return {
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search
  };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 COMPREHENSIVE TEST SUITE: PATIENT PORTAL MODULE');
  console.log('🧪 ========================================================\n');

  // Step 1: Authenticate Patient User
  console.log('--- 1. Authenticating Patient Account ---');
  const loginRes = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'patient@auracare.com', password: 'Clinic2026!' });

  assert(loginRes.status === 200, 'Patient login returned HTTP 200');
  assert(loginRes.data.success === true, 'Patient login successful');
  patientToken = loginRes.data.data.token;
  assert(!!patientToken, 'JWT token acquired for authenticated patient');

  // Step 2: Patient Dashboard Overview (Real-Time MySQL)
  console.log('\n--- 2. Testing Patient Dashboard Overview (GET /portal/patient/dashboard) ---');
  const dashRes = await request({
    ...parseUrl('/portal/patient/dashboard'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(dashRes.status === 200, 'GET /portal/patient/dashboard returned HTTP 200');
  assert(dashRes.data.success === true, 'Dashboard response indicated success');
  
  const d = dashRes.data.data;
  assert(!!d.patient, 'Patient demographic profile present');
  assert(!!d.patient.patient_code, `Patient Code resolved: ${d.patient.patient_code}`);
  assert(!!d.metrics, 'Dashboard metrics summary calculated');
  assert(typeof d.metrics.upcoming_appointments_count === 'number', 'Upcoming appointments KPI present');
  assert(typeof d.metrics.active_prescriptions_count === 'number', 'Active prescriptions KPI present');
  assert(typeof d.metrics.pending_lab_reports_count === 'number', 'Pending lab reports KPI present');
  assert(typeof d.metrics.outstanding_balance === 'number', `Outstanding balance calculated: $${d.metrics.outstanding_balance.toFixed(2)}`);

  assert(Array.isArray(d.upcoming_appointments), 'Upcoming appointments returned as array');
  assert(Array.isArray(d.recent_visits), 'Recent clinical visits returned as array');
  assert(Array.isArray(d.active_prescriptions), 'Active prescriptions returned as array');
  assert(Array.isArray(d.recent_lab_reports), 'Recent lab reports returned as array');
  assert(Array.isArray(d.all_recent_invoices), 'Invoices returned as array');
  assert(Array.isArray(d.recent_payments), 'Recent payment receipts returned as array');

  // Step 3: Patient Appointments (GET, POST, CANCEL)
  console.log('\n--- 3. Testing Patient Self Appointments ---');
  const apptListRes = await request({
    ...parseUrl('/portal/patient/appointments'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(apptListRes.status === 200, 'GET /portal/patient/appointments returned HTTP 200');
  assert(Array.isArray(apptListRes.data.data), 'Appointments list is an array');

  const testDay = String(Math.floor(Math.random() * 25) + 1).padStart(2, '0');
  const testHour = String(Math.floor(Math.random() * 8) + 9).padStart(2, '0');
  const testMin = String(Math.floor(Math.random() * 4) * 15).padStart(2, '0');

  // Book a new appointment for authenticated patient
  const bookRes = await request({
    ...parseUrl('/portal/patient/appointments'),
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${patientToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    department_id: 1,
    doctor_id: 1,
    appointment_date: `2026-11-${testDay}`,
    appointment_time: `${testHour}:${testMin}:00`,
    reason: 'Routine annual cardiology checkup'
  });

  assert(bookRes.status === 201, 'POST /portal/patient/appointments created appointment (HTTP 201)');
  assert(bookRes.data.success === true, 'Appointment booked successfully');
  const createdApptId = bookRes.data.data.id;
  assert(!!createdApptId, `Appointment generated with ID: ${createdApptId}`);

  // Cancel the appointment
  const cancelRes = await request({
    ...parseUrl(`/portal/patient/appointments/${createdApptId}/cancel`),
    method: 'PATCH',
    headers: { 
      'Authorization': `Bearer ${patientToken}`,
      'Content-Type': 'application/json'
    }
  }, { reason: 'Schedule conflict with work' });

  assert(cancelRes.status === 200, 'PATCH /portal/patient/appointments/:id/cancel returned HTTP 200');
  assert(cancelRes.data.data.status === 'cancelled', 'Appointment status updated to cancelled');

  // Step 4: Medical History & EMR Encounters
  console.log('\n--- 4. Testing Patient Medical History (GET /portal/patient/medical-history) ---');
  const historyRes = await request({
    ...parseUrl('/portal/patient/medical-history'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(historyRes.status === 200, 'GET /portal/patient/medical-history returned HTTP 200');
  assert(Array.isArray(historyRes.data.data.records), 'Clinical medical records array returned');
  assert(Array.isArray(historyRes.data.data.vitals), 'Vitals history array returned');

  // Step 5: Prescriptions
  console.log('\n--- 5. Testing Patient Prescriptions (GET /portal/patient/prescriptions) ---');
  const rxRes = await request({
    ...parseUrl('/portal/patient/prescriptions'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(rxRes.status === 200, 'GET /portal/patient/prescriptions returned HTTP 200');
  assert(Array.isArray(rxRes.data.data), 'Prescriptions array returned');

  // Step 6: Lab Reports & Diagnostics
  console.log('\n--- 6. Testing Patient Lab Reports (GET /portal/patient/lab-reports) ---');
  const labRes = await request({
    ...parseUrl('/portal/patient/lab-reports'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(labRes.status === 200, 'GET /portal/patient/lab-reports returned HTTP 200');
  assert(Array.isArray(labRes.data.data), 'Lab orders array returned');

  // Step 7: Invoices & Payments
  console.log('\n--- 7. Testing Patient Invoices & Payments ---');
  const invRes = await request({
    ...parseUrl('/portal/patient/invoices'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(invRes.status === 200, 'GET /portal/patient/invoices returned HTTP 200');
  assert(Array.isArray(invRes.data.data), 'Invoices list returned');

  const payRes = await request({
    ...parseUrl('/portal/patient/payments'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(payRes.status === 200, 'GET /portal/patient/payments returned HTTP 200');
  assert(Array.isArray(payRes.data.data), 'Payments ledger returned');

  // Step 8: Profile & Demographic Updates
  console.log('\n--- 8. Testing Patient Profile Updates ---');
  const profRes = await request({
    ...parseUrl('/portal/patient/profile'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(profRes.status === 200, 'GET /portal/patient/profile returned HTTP 200');
  assert(!!profRes.data.data.email, 'Patient profile contains email');

  const updateProfRes = await request({
    ...parseUrl('/portal/patient/profile'),
    method: 'PUT',
    headers: { 
      'Authorization': `Bearer ${patientToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    phone: '+1 (555) 998-1122',
    address: '450 Healthcare Blvd, Suite 12B, Metro Health City',
    emergency_contact: 'Dr. Sarah Vance (+1 555-889-0011)',
    allergies: 'Penicillin, Dust mites'
  });

  assert(updateProfRes.status === 200, 'PUT /portal/patient/profile returned HTTP 200');
  assert(updateProfRes.data.data.allergies === 'Penicillin, Dust mites', 'Patient allergies updated');

  // Step 9: CRITICAL SECURITY TEST: Patient Data Isolation
  console.log('\n--- 9. CRITICAL SECURITY TEST: Patient Data Isolation ---');
  // Attempt to access another patient's isolated records
  const unauthAccessRes = await request({
    ...parseUrl('/patients/2'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(unauthAccessRes.status === 403, 'Patient cannot access Patient 2 record (HTTP 403 Forbidden)');

  const unauthDocAccess = await request({
    ...parseUrl('/patients/2/documents'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(unauthDocAccess.status === 403, 'Patient cannot access Patient 2 documents (HTTP 403 Forbidden)');

  console.log('\n======================================================');
  console.log('🏁 ALL PATIENT PORTAL TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
