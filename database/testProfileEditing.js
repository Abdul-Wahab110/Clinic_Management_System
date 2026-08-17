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

async function runProfileEditingTest() {
  console.log('====================================================');
  console.log('👤 TESTING UNIVERSAL PROFILE EDITING & PASSWORD CHANGE');
  console.log('====================================================\n');

  // 1. Doctor Profile Update
  console.log('--- 1. Testing Doctor Profile Update ---');
  const docLogin = await sendReq('POST', '/api/v1/auth/login', {
    email: 'marcus.vance@auracare.com',
    password: 'Clinic2026!'
  });
  assert(docLogin.status === 200, 'Doctor logged in');
  const docToken = docLogin.data.data.token;

  const docUpdateRes = await sendReq('PUT', '/api/v1/auth/me', {
    full_name: 'Dr. Marcus Vance MD',
    phone: '+1 (555) 777-8899',
    specialization: 'Senior Interventional Cardiologist',
    qualification: 'MD, FACC, FSCAI',
    room_number: 'Cardiac Suite 402',
    experience_years: 18,
    bio: 'Lead Cardiologist specializing in minimally invasive cardiac catheterization and preventative care.'
  }, docToken);

  assert(docUpdateRes.status === 200, 'Doctor profile updated via PUT /auth/me');
  assert(docUpdateRes.data.data.fullName === 'Dr. Marcus Vance MD', 'Full name updated in returned payload');
  assert(docUpdateRes.data.data.doctor.specialization === 'Senior Interventional Cardiologist', 'Doctor specialization updated');
  assert(docUpdateRes.data.data.doctor.roomNumber === 'Cardiac Suite 402', 'Doctor room updated');

  // Verify in MySQL
  const [[docDbUser]] = await pool.query('SELECT full_name, phone FROM users WHERE email = ?', ['marcus.vance@auracare.com']);
  assert(docDbUser.full_name === 'Dr. Marcus Vance MD', 'MySQL users table persisted new full_name');

  const [[docDbDoc]] = await pool.query('SELECT specialization, room_number, experience_years FROM doctors WHERE user_id = ?', [docLogin.data.data.user.id]);
  assert(docDbDoc.specialization === 'Senior Interventional Cardiologist', 'MySQL doctors table persisted new specialization');
  assert(docDbDoc.room_number === 'Cardiac Suite 402', 'MySQL doctors table persisted room_number');
  assert(docDbDoc.experience_years === 18, 'MySQL doctors table persisted experience_years');

  // 2. Patient Profile Update
  console.log('\n--- 2. Testing Patient Profile Update ---');
  const patLogin = await sendReq('POST', '/api/v1/auth/login', {
    email: 'patient@auracare.com',
    password: 'Clinic2026!'
  });
  assert(patLogin.status === 200, 'Patient logged in');
  const patToken = patLogin.data.data.token;

  const patUpdateRes = await sendReq('PUT', '/api/v1/auth/me', {
    full_name: 'Arthur Vance Pendleton',
    phone: '+1 (555) 999-1122',
    gender: 'male',
    date_of_birth: '1982-05-14',
    blood_group: 'AB+',
    address: '452 Elm Street, Clinical District, Metropolis'
  }, patToken);

  assert(patUpdateRes.status === 200, 'Patient profile updated via PUT /auth/me');
  assert(patUpdateRes.data.data.fullName === 'Arthur Vance Pendleton', 'Patient full name updated');
  assert(patUpdateRes.data.data.patient.bloodGroup === 'AB+', 'Patient blood group updated');
  assert(patUpdateRes.data.data.patient.address.includes('452 Elm Street'), 'Patient address updated');

  // Verify in MySQL
  const [[patDbUser]] = await pool.query('SELECT full_name, phone FROM users WHERE email = ?', ['patient@auracare.com']);
  assert(patDbUser.full_name === 'Arthur Vance Pendleton', 'MySQL users table updated patient full_name');

  const [[patDbPat]] = await pool.query('SELECT first_name, last_name, blood_group, address FROM patients WHERE user_id = ?', [patLogin.data.data.user.id]);
  assert(patDbPat.first_name === 'Arthur' && patDbPat.last_name === 'Vance Pendleton', 'MySQL patients table split and updated first/last name');
  assert(patDbPat.blood_group === 'AB+', 'MySQL patients table updated blood group');

  // 3. Password Change Workflow
  console.log('\n--- 3. Testing Secure Password Change Workflow ---');
  const changePwdRes = await sendReq('POST', '/api/v1/auth/change-password', {
    current_password: 'Clinic2026!',
    new_password: 'NewSecurePassword2026@!'
  }, patToken);

  assert(changePwdRes.status === 200, 'Password changed successfully');

  // Attempt login with OLD password -> MUST FAIL
  const failOldLogin = await sendReq('POST', '/api/v1/auth/login', {
    email: 'patient@auracare.com',
    password: 'Clinic2026!'
  });
  assert(failOldLogin.status === 401, 'Login with old password correctly rejected with HTTP 401');

  // Attempt login with NEW password -> MUST SUCCEED
  const successNewLogin = await sendReq('POST', '/api/v1/auth/login', {
    email: 'patient@auracare.com',
    password: 'NewSecurePassword2026@!'
  });
  assert(successNewLogin.status === 200, 'Login with new password succeeded with HTTP 200');

  // Restore original password for ongoing testing
  const restorePwdRes = await sendReq('POST', '/api/v1/auth/change-password', {
    current_password: 'NewSecurePassword2026@!',
    new_password: 'Clinic2026!'
  }, successNewLogin.data.data.token);
  assert(restorePwdRes.status === 200, 'Original password restored');

  console.log('\n====================================================');
  console.log('🏁 ALL PROFILE & PASSWORD TESTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
}

runProfileEditingTest().catch(e => {
  console.error(e);
  process.exit(1);
});
