const http = require('http');
const { pool } = require('../server/config/db');
const bcrypt = require('bcryptjs');

const TEST_PORT = parseInt(process.env.PORT || '5000', 10);

function sendPost(path, payload, token = null) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: 'POST',
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
    req.write(postData);
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

async function runTests() {
  console.log('====================================================');
  console.log('🏥 PATIENT REGISTRATION COMPREHENSIVE VERIFICATION');
  console.log('====================================================\n');

  // Clean up any test users first
  const testEmails = [
    'shahzarnab796@gmail.com',
    'pakistan.test@auracare.com',
    'admin.created.pat@auracare.com',
    'dup.test@auracare.com'
  ];
  for (const em of testEmails) {
    const [u] = await pool.query('SELECT id FROM users WHERE email = ?', [em]);
    if (u.length > 0) {
      await pool.query('DELETE FROM patients WHERE user_id = ?', [u[0].id]);
      await pool.query('DELETE FROM audit_logs WHERE user_id = ?', [u[0].id]);
      await pool.query('DELETE FROM users WHERE id = ?', [u[0].id]);
    }
  }

  // Login as Super Admin
  console.log('--- 1. Authenticating as Super Admin ---');
  const adminLogin = await sendPost('/api/v1/auth/login', {
    email: 'superadmin@auracare.com',
    password: 'Clinic2026!'
  });
  assert(adminLogin.status === 200, 'Super admin login successful');
  const adminToken = adminLogin.data.data.token;

  // Test 2: User's exact registration payload on Public Registration API
  console.log('\n--- 2. Testing Exact User Registration (Public API) ---');
  const userRegistration = await sendPost('/api/v1/auth/register', {
    full_name: 'Zarnab',
    email: 'shahzarnab796@gmail.com',
    phone: '03212345676',
    gender: 'Male',
    date_of_birth: '2005-09-11',
    blood_group: 'A+',
    password: 'Clinic2026!',
    address: 'Area gate, Gujrat, Punjab, Pakistan'
  });

  assert(userRegistration.status === 201, `Public registration returned HTTP 201 (got ${userRegistration.status})`);
  assert(userRegistration.data.success === true, 'Public registration response is successful');
  const registeredUserId = userRegistration.data.data.user.id;
  const registeredPatientCode = userRegistration.data.data.user.patientCode;
  assert(!!registeredUserId, `User created with ID: ${registeredUserId}`);
  assert(!!registeredPatientCode, `Patient Code generated: ${registeredPatientCode}`);

  // Test 3: Admin Patient Creation API
  console.log('\n--- 3. Testing Admin Patient Creation (POST /api/v1/patients) ---');
  const adminPatientCreation = await sendPost('/api/v1/patients', {
    full_name: 'Zarnab Admin Created',
    email: 'admin.created.pat@auracare.com',
    phone: '+923212345676',
    gender: 'Male',
    date_of_birth: '11/09/2005', // DD/MM/YYYY format test
    blood_group: 'A+',
    address: 'Area gate, Gujrat, Punjab, Pakistan'
  }, adminToken);

  assert(adminPatientCreation.status === 201, `Admin patient creation returned HTTP 201 (got ${adminPatientCreation.status})`);
  assert(adminPatientCreation.data.success === true, 'Admin patient creation response is successful');
  const adminCreatedPatientId = adminPatientCreation.data.data.id;
  assert(!!adminCreatedPatientId, `Admin created patient ID: ${adminCreatedPatientId}`);

  // Test 4: Valid Pakistani Phone variations
  console.log('\n--- 4. Testing Pakistani Phone Variations ---');
  const pakPhoneTest = await sendPost('/api/v1/auth/register', {
    full_name: 'Pakistan Phone Test',
    email: 'pakistan.test@auracare.com',
    phone: '+92 321 2345676',
    gender: 'male',
    date_of_birth: '2005-09-11',
    blood_group: 'B+',
    password: 'Password123#',
    address: 'Gujrat, Punjab'
  });
  assert(pakPhoneTest.status === 201, 'Pakistani international phone format (+92 321 2345676) accepted');

  // Test 5: Invalid Phone Rejection
  console.log('\n--- 5. Testing Invalid Phone Rejection ---');
  const invalidPhone = await sendPost('/api/v1/auth/register', {
    full_name: 'Invalid Phone User',
    email: 'invalid.phone@auracare.com',
    phone: '123', // Too short
    password: 'Clinic2026!'
  });
  assert(invalidPhone.status === 422, 'Invalid short phone number rejected with HTTP 422');
  assert(invalidPhone.data.message.includes('contact phone number is required'), 'Helpful error message returned for invalid phone');

  // Test 6: Duplicate Email Rejection
  console.log('\n--- 6. Testing Duplicate Email Rejection ---');
  const duplicateEmail = await sendPost('/api/v1/auth/register', {
    full_name: 'Duplicate Zarnab',
    email: 'shahzarnab796@gmail.com', // Duplicate
    phone: '03212345676',
    password: 'Clinic2026!'
  });
  assert(duplicateEmail.status === 409, 'Duplicate email rejected with HTTP 409 Conflict');
  assert(duplicateEmail.data.message.includes('already registered'), 'Duplicate email error message returned');

  // Test 7: Invalid Email Rejection
  console.log('\n--- 7. Testing Invalid Email Rejection ---');
  const invalidEmail = await sendPost('/api/v1/auth/register', {
    full_name: 'Bad Email',
    email: 'not-an-email',
    phone: '03212345676',
    password: 'Clinic2026!'
  });
  assert(invalidEmail.status === 422, 'Invalid email rejected with HTTP 422');

  // Test 8: Invalid DOB in the future
  console.log('\n--- 8. Testing Future Date of Birth Rejection ---');
  const futureDob = await sendPost('/api/v1/auth/register', {
    full_name: 'Future Person',
    email: 'future.dob@auracare.com',
    phone: '03212345676',
    date_of_birth: '2099-01-01',
    password: 'Clinic2026!'
  });
  assert(futureDob.status === 422, 'Future DOB rejected with HTTP 422');
  assert(futureDob.data.message.includes('Date of birth must be a valid date in the past'), 'Future DOB error message returned');

  // Test 9: Missing Required Field (Full Name)
  console.log('\n--- 9. Testing Missing Required Field (Full Name) ---');
  const missingName = await sendPost('/api/v1/auth/register', {
    email: 'noname@auracare.com',
    phone: '03212345676',
    password: 'Clinic2026!'
  });
  assert(missingName.status === 422, 'Missing full name rejected with HTTP 422');

  // Test 10: Invalid Password Format
  console.log('\n--- 10. Testing Invalid Password Format ---');
  const badPassword = await sendPost('/api/v1/auth/register', {
    full_name: 'Bad Password User',
    email: 'badpw@auracare.com',
    phone: '03212345676',
    password: 'simplepassword' // No upper, digit, special
  });
  assert(badPassword.status === 422, 'Weak password rejected with HTTP 422');
  assert(badPassword.data.message.includes('Password must be at least 8 characters long'), 'Password complexity error message returned');

  // Database Verification
  console.log('\n--- 11. Verifying Database State in MySQL ---');
  const [[userRow]] = await pool.query('SELECT * FROM users WHERE id = ?', [registeredUserId]);
  assert(!!userRow, `User record exists in MySQL users table (ID: ${userRow.id})`);
  assert(userRow.email === 'shahzarnab796@gmail.com', `User email verified: ${userRow.email}`);
  assert(userRow.full_name === 'Zarnab', `User full name verified: ${userRow.full_name}`);
  assert(userRow.phone === '03212345676', `User phone verified: ${userRow.phone}`);
  assert(userRow.role_id === 9, `User role_id is 9 (Patient)`);
  assert(userRow.status === 'active', `User status is active`);
  assert(userRow.password_hash !== 'Clinic2026!', `Password is securely hashed (length: ${userRow.password_hash.length})`);
  const isHashValid = await bcrypt.compare('Clinic2026!', userRow.password_hash);
  assert(isHashValid === true, 'Bcrypt hash correctly validates against password');

  const [[patientRow]] = await pool.query('SELECT * FROM patients WHERE user_id = ?', [registeredUserId]);
  assert(!!patientRow, `Patient record exists in MySQL patients table (ID: ${patientRow.id})`);
  assert(patientRow.patient_code === registeredPatientCode, `Patient code matched: ${patientRow.patient_code}`);
  assert(patientRow.first_name === 'Zarnab', `Patient first_name matched: ${patientRow.first_name}`);
  assert(patientRow.gender === 'male', `Patient gender normalized to lowercase: ${patientRow.gender}`);
  assert(patientRow.blood_group === 'A+', `Patient blood_group matched: ${patientRow.blood_group}`);
  assert(patientRow.address === 'Area gate, Gujrat, Punjab, Pakistan', `Patient address matched: ${patientRow.address}`);

  console.log('\n====================================================');
  console.log('🏁 ALL 11 PATIENT REGISTRATION TESTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
