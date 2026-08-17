const http = require('http');
const { pool } = require('../server/config/db');

const TEST_PORT = parseInt(process.env.PORT || '5000', 10);

function sendReq(method, path, payload = null, token = null) {
  return new Promise((resolve) => {
    const postData = payload ? JSON.stringify(payload) : '';
    const headers = {
      'Content-Type': 'application/json'
    };
    if (postData) headers['Content-Length'] = Buffer.byteLength(postData);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
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

async function runAppointmentWorkflowTest() {
  console.log('====================================================');
  console.log('🏥 TESTING APPOINTMENT REQUEST & RBAC APPROVAL WORKFLOW');
  console.log('====================================================\n');

  // 1. Authenticate users for different roles
  console.log('--- 1. Authenticating Roles ---');
  const superAdminLogin = await sendReq('POST', '/api/v1/auth/login', { email: 'superadmin@auracare.com', password: 'Clinic2026!' });
  const doc1Login = await sendReq('POST', '/api/v1/auth/login', { email: 'marcus.vance@auracare.com', password: 'Clinic2026!' });
  const doc2Login = await sendReq('POST', '/api/v1/auth/login', { email: 'elena.rostova@auracare.com', password: 'Clinic2026!' });
  const nurseLogin = await sendReq('POST', '/api/v1/auth/login', { email: 'nurse@auracare.com', password: 'Clinic2026!' });
  const patient1Login = await sendReq('POST', '/api/v1/auth/login', { email: 'patient@auracare.com', password: 'Clinic2026!' });

  assert(superAdminLogin.status === 200, 'Super Admin logged in');
  assert(doc1Login.status === 200, 'Doctor 1 logged in');
  assert(doc2Login.status === 200, 'Doctor 2 logged in');
  assert(nurseLogin.status === 200, 'Nurse logged in');
  assert(patient1Login.status === 200, 'Patient 1 logged in');

  const superAdminToken = superAdminLogin.data.data.token;
  const doc1Token = doc1Login.data.data.token;
  const doc2Token = doc2Login.data.data.token;
  const nurseToken = nurseLogin.data.data.token;
  const patient1Token = patient1Login.data.data.token;

  // 2. Patient 1 requests an appointment with Doctor 1
  console.log('\n--- 2. Booking Appointment Request (Patient 1 -> Doctor 1) ---');
  const targetDate = '2026-10-15';
  const targetTime = '11:00:00';
  
  // Clean existing test appointments on this slot if any
  await pool.query('DELETE FROM appointments WHERE appointment_date = ? AND appointment_time = ?', [targetDate, targetTime]);

  const bookingRes = await sendReq('POST', '/api/v1/appointments', {
    department_id: 1, // Cardiology
    doctor_id: 1, // Doctor 1
    appointment_date: targetDate,
    appointment_time: targetTime,
    reason: 'Routine cardiac health review and ECG',
    type: 'consultation'
  }, patient1Token);

  assert(bookingRes.status === 201, `Appointment request created (HTTP 201, status: ${bookingRes.data.data.status})`);
  assert(bookingRes.data.data.status === 'pending', 'Initial status of patient-requested appointment is pending');
  const apptId = bookingRes.data.data.id;
  const apptNumber = bookingRes.data.data.appointmentNumber;

  // 3. Test Available Slots Endpoint
  console.log('\n--- 3. Testing Available Slots Calculation ---');
  const slotsRes = await sendReq('GET', `/api/v1/appointments/available-slots?doctor_id=1&date=${targetDate}`);
  assert(slotsRes.status === 200, 'Available slots calculated');
  const bookedSlot = slotsRes.data.data.slots.find(s => s.time === '11:00');
  assert(bookedSlot && bookedSlot.available === false, 'Booked slot (11:00) is marked available: false');
  const freeSlot = slotsRes.data.data.slots.find(s => s.time !== '11:00');
  if (freeSlot) {
    assert(freeSlot.available === true, `Free slot (${freeSlot.time}) is marked available: true`);
  }

  // 4. Test Double Booking Prevention
  console.log('\n--- 4. Testing Double-Booking Collision Prevention ---');
  const doubleBookRes = await sendReq('POST', '/api/v1/appointments', {
    department_id: 1,
    doctor_id: 1,
    appointment_date: targetDate,
    appointment_time: targetTime,
    reason: 'Attempt double booking'
  }, patient1Token);
  assert(doubleBookRes.status === 400, 'Double booking rejected with HTTP 400');
  assert(doubleBookRes.data.message.includes('already been booked'), 'Helpful double-booking collision message returned');

  // 5. Verify Visibility Scoping for Pending Request
  console.log('\n--- 5. Verifying Visibility Scoping for Pending Request ---');
  
  // Super Admin: Must see pending request
  const saList = await sendReq('GET', `/api/v1/appointments?search=${apptNumber}`, null, superAdminToken);
  assert(saList.data.data.some(a => a.id === apptId), 'Super Admin CAN see pending request');

  // Assigned Doctor (Doctor 1): Must see pending request
  const doc1List = await sendReq('GET', `/api/v1/appointments?search=${apptNumber}`, null, doc1Token);
  assert(doc1List.data.data.some(a => a.id === apptId), 'Assigned Doctor (Doctor 1) CAN see pending request');

  // Non-assigned Doctor (Doctor 2): Must NOT see Doctor 1's pending request
  const doc2List = await sendReq('GET', `/api/v1/appointments?search=${apptNumber}`, null, doc2Token);
  assert(!doc2List.data.data.some(a => a.id === apptId), 'Other Doctor (Doctor 2) CANNOT see Doctor 1 pending request');

  // Nurse: Must NOT see pending request
  const nurseList = await sendReq('GET', `/api/v1/appointments?status=pending`, null, nurseToken);
  assert(!nurseList.data.data.some(a => a.id === apptId), 'Nurse CANNOT see pending appointment request');

  // 6. Test Approval Workflow (Doctor 1 Approves)
  console.log('\n--- 6. Testing Approval Workflow (Doctor 1 Approves) ---');
  const approveRes = await sendReq('POST', `/api/v1/appointments/${apptId}/approve`, {}, doc1Token);
  assert(approveRes.status === 200, 'Doctor 1 approved appointment request');
  assert(approveRes.data.data.status === 'confirmed', 'Appointment status updated to confirmed globally');

  // 7. Verify Global Status Consistency after Approval
  console.log('\n--- 7. Verifying Global Status Consistency Across All Portals ---');
  const saAppt = await sendReq('GET', `/api/v1/appointments/${apptId}`, null, superAdminToken);
  assert(saAppt.data.data.status === 'confirmed', 'Super Admin portal reflects status: confirmed');

  const doc1Appt = await sendReq('GET', `/api/v1/appointments/${apptId}`, null, doc1Token);
  assert(doc1Appt.data.data.status === 'confirmed', 'Doctor 1 portal reflects status: confirmed');

  const patAppt = await sendReq('GET', `/api/v1/appointments/${apptId}`, null, patient1Token);
  assert(patAppt.data.data.status === 'confirmed', 'Patient 1 portal reflects status: confirmed');

  // 8. Test Rejection Workflow on a fresh request
  console.log('\n--- 8. Testing Rejection Workflow ---');
  const rejectTestDate = '2026-10-16';
  const rejectTestTime = '14:00:00';
  await pool.query('DELETE FROM appointments WHERE appointment_date = ? AND appointment_time = ?', [rejectTestDate, rejectTestTime]);

  const reqToReject = await sendReq('POST', '/api/v1/appointments', {
    department_id: 1,
    doctor_id: 1,
    appointment_date: rejectTestDate,
    appointment_time: rejectTestTime,
    reason: 'Temporary slot to test rejection'
  }, patient1Token);
  const rejectApptId = reqToReject.data.data.id;

  const rejectRes = await sendReq('POST', `/api/v1/appointments/${rejectApptId}/reject`, {
    rejection_reason: 'Doctor is scheduled for emergency surgery during this slot.'
  }, doc1Token);

  assert(rejectRes.status === 200, 'Rejection API returned HTTP 200');
  assert(rejectRes.data.data.status === 'rejected', 'Status updated to rejected');

  const [[rejectedRow]] = await pool.query('SELECT * FROM appointments WHERE id = ?', [rejectApptId]);
  assert(rejectedRow.status === 'rejected', 'Database reflects status = rejected');
  assert(rejectedRow.rejection_reason.includes('emergency surgery'), 'Database saved rejection_reason');
  assert(!!rejectedRow.rejected_at, 'Database recorded rejected_at timestamp');

  // Clean up test appointments
  await pool.query('DELETE FROM appointments WHERE id IN (?, ?)', [apptId, rejectApptId]);

  console.log('\n====================================================');
  console.log('🏁 ALL APPOINTMENT WORKFLOW TESTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
}

runAppointmentWorkflowTest().catch(e => {
  console.error(e);
  process.exit(1);
});
