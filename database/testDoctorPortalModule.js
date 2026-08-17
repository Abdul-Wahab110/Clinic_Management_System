const http = require('http');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let doctorToken = '';
let patientToken = '';

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
  console.log('🧪 COMPREHENSIVE TEST SUITE: DOCTOR PORTAL MODULE');
  console.log('🧪 ========================================================\n');

  // Step 1: Authenticate Doctor Account
  console.log('--- 1. Authenticating Doctor Account ---');
  const loginRes = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'marcus.vance@auracare.com', password: 'Clinic2026!' });

  assert(loginRes.status === 200, 'Doctor login returned HTTP 200');
  assert(loginRes.data.success === true, 'Doctor login successful');
  doctorToken = loginRes.data.data.token;
  assert(!!doctorToken, 'JWT token acquired for authenticated doctor');

  // Step 2: Doctor Dashboard Workspace Overview
  console.log('\n--- 2. Testing Doctor Dashboard Overview (GET /portal/doctor/dashboard) ---');
  const dashRes = await request({
    ...parseUrl('/portal/doctor/dashboard'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(dashRes.status === 200, 'GET /portal/doctor/dashboard returned HTTP 200');
  assert(dashRes.data.success === true, 'Doctor dashboard response indicated success');

  const d = dashRes.data.data;
  assert(!!d.doctor, 'Physician profile metadata present');
  assert(!!d.doctor.doctor_code, `Doctor Code resolved: ${d.doctor.doctor_code}`);
  assert(!!d.doctor.specialization, `Specialization present: ${d.doctor.specialization}`);
  assert(!!d.metrics, 'Dashboard metrics summary calculated');
  assert(typeof d.metrics.today_appointments_count === 'number', 'Today appointments KPI present');
  assert(typeof d.metrics.waiting_patients_count === 'number', 'Waiting patients KPI present');
  assert(typeof d.metrics.completed_consultations_count === 'number', 'Completed consultations KPI present');
  assert(typeof d.metrics.follow_ups_due_count === 'number', 'Follow-ups due KPI present');
  assert(typeof d.metrics.pending_lab_orders_count === 'number', 'Pending lab orders KPI present');

  assert(Array.isArray(d.today_appointments), 'Today appointments returned as array');
  assert(Array.isArray(d.waiting_patients), 'Waiting patients returned as array');
  assert(Array.isArray(d.completed_today), 'Completed consultations returned as array');
  assert(Array.isArray(d.follow_ups), 'Follow-up roster returned as array');
  assert(Array.isArray(d.pending_lab_results), 'Pending lab results returned as array');

  // Step 3: Doctor Appointments
  console.log('\n--- 3. Testing Doctor Appointments (GET /portal/doctor/appointments) ---');
  const apptsRes = await request({
    ...parseUrl('/portal/doctor/appointments'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(apptsRes.status === 200, 'GET /portal/doctor/appointments returned HTTP 200');
  assert(Array.isArray(apptsRes.data.data), 'Doctor appointments returned as array');

  // Step 4: Doctor Patients Directory
  console.log('\n--- 4. Testing Doctor Patients Directory (GET /portal/doctor/patients) ---');
  const patientsRes = await request({
    ...parseUrl('/portal/doctor/patients'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(patientsRes.status === 200, 'GET /portal/doctor/patients returned HTTP 200');
  assert(Array.isArray(patientsRes.data.data), 'Patients directory returned as array');

  // Step 5: Doctor Consultations
  console.log('\n--- 5. Testing Doctor Consultations (GET /portal/doctor/consultations) ---');
  const consultRes = await request({
    ...parseUrl('/portal/doctor/consultations'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(consultRes.status === 200, 'GET /portal/doctor/consultations returned HTTP 200');
  assert(Array.isArray(consultRes.data.data), 'Consultations notes returned as array');

  // Step 6: Doctor Prescriptions
  console.log('\n--- 6. Testing Doctor Prescriptions (GET /portal/doctor/prescriptions) ---');
  const rxRes = await request({
    ...parseUrl('/portal/doctor/prescriptions'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(rxRes.status === 200, 'GET /portal/doctor/prescriptions returned HTTP 200');
  assert(Array.isArray(rxRes.data.data), 'Prescription orders returned as array');

  // Step 7: Doctor Diagnostic Lab Orders
  console.log('\n--- 7. Testing Doctor Lab Orders (GET /portal/doctor/lab-orders) ---');
  const labRes = await request({
    ...parseUrl('/portal/doctor/lab-orders'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(labRes.status === 200, 'GET /portal/doctor/lab-orders returned HTTP 200');
  assert(Array.isArray(labRes.data.data), 'Lab orders returned as array');

  // Step 8: Doctor Follow-up Roster
  console.log('\n--- 8. Testing Doctor Follow-up Roster (GET /portal/doctor/follow-ups) ---');
  const followUpRes = await request({
    ...parseUrl('/portal/doctor/follow-ups'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(followUpRes.status === 200, 'GET /portal/doctor/follow-ups returned HTTP 200');
  assert(Array.isArray(followUpRes.data.data), 'Follow-up roster returned as array');

  // Step 9: Doctor Profile & Schedule Management
  console.log('\n--- 9. Testing Doctor Profile & Schedule ---');
  const profileRes = await request({
    ...parseUrl('/portal/doctor/profile'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(profileRes.status === 200, 'GET /portal/doctor/profile returned HTTP 200');
  assert(!!profileRes.data.data.email, 'Profile contains doctor email');

  // Update profile
  const updateProfRes = await request({
    ...parseUrl('/portal/doctor/profile'),
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${doctorToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    consultation_fee: 150.00,
    room_number: 'Room 302-A',
    bio: 'Board-certified cardiologist specializing in preventive cardiology and heart rhythm management.'
  });

  assert(updateProfRes.status === 200, 'PUT /portal/doctor/profile returned HTTP 200');
  assert(parseFloat(updateProfRes.data.data.consultation_fee) === 150, 'Consultation fee updated to 150.00');

  // Schedule timetable
  const scheduleRes = await request({
    ...parseUrl('/portal/doctor/schedule'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });

  assert(scheduleRes.status === 200, 'GET /portal/doctor/schedule returned HTTP 200');
  assert(Array.isArray(scheduleRes.data.data.schedules), 'Schedule timetable contains weekly slots');

  // Submit leave request
  const leaveRes = await request({
    ...parseUrl('/portal/doctor/leaves'),
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${doctorToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    start_date: '2026-10-01',
    end_date: '2026-10-05',
    leave_type: 'conference',
    reason: 'Annual Cardiology Summit 2026'
  });

  assert(leaveRes.status === 201, 'POST /portal/doctor/leaves returned HTTP 201');
  assert(leaveRes.data.data.status === 'pending', 'Leave request recorded as pending');

  // Step 10: Role Security & Access Control
  console.log('\n--- 10. CRITICAL SECURITY TEST: Role Access Control ---');
  const patLogin = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'patient@auracare.com', password: 'Clinic2026!' });

  patientToken = patLogin.data.data.token;

  const forbiddenRes = await request({
    ...parseUrl('/portal/doctor/dashboard'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(forbiddenRes.status === 403, 'Patient cannot access Doctor Workspace (HTTP 403 Forbidden)');

  console.log('\n======================================================');
  console.log('🏁 ALL DOCTOR PORTAL TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
