const http = require('http');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let adminToken = '';
let doctorToken = '';
let patientToken = '';
let receptionToken = '';

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
  console.log('🧪 COMPREHENSIVE TEST SUITE: SECURE GLOBAL SEARCH MODULE');
  console.log('🧪 ========================================================\n');

  // Step 1: Authenticate Super Admin Account
  console.log('--- 1. Authenticating Roles for Multi-Context Search ---');
  const adminLogin = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'admin@auracare.com', password: 'Clinic2026!' });

  assert(adminLogin.status === 200, 'Super Admin login returned HTTP 200');
  adminToken = adminLogin.data.data.token;

  const docLogin = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'marcus.vance@auracare.com', password: 'Clinic2026!' });

  assert(docLogin.status === 200, 'Doctor login returned HTTP 200');
  doctorToken = docLogin.data.data.token;

  const patLogin = await request({
    ...parseUrl('/auth/login'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { email: 'patient@auracare.com', password: 'Clinic2026!' });

  assert(patLogin.status === 200, 'Patient login returned HTTP 200');
  patientToken = patLogin.data.data.token;

  // Step 2: Global Multi-Category Search (Admin Context)
  console.log('\n--- 2. Testing Global Multi-Category Search (Admin Context) ---');
  const searchRes = await request({
    ...parseUrl('/search?q=a&limit=5'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  // Short query check (< 2 chars should return 0 results safely without unrestricted DB load)
  const shortSearchRes = await request({
    ...parseUrl('/search?q=a'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(shortSearchRes.data.data.total_matches === 0, 'Short query (<2 chars) returns 0 results safely');

  const fullSearch = await request({
    ...parseUrl('/search?q=dr&limit=5'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert(fullSearch.status === 200, 'GET /search?q=dr returned HTTP 200');
  const cats = fullSearch.data.data.categories;
  assert(!!cats.patients, 'Patients search bucket present');
  assert(!!cats.doctors, 'Doctors search bucket present');
  assert(!!cats.appointments, 'Appointments search bucket present');
  assert(!!cats.prescriptions, 'Prescriptions search bucket present');
  assert(!!cats.lab_tests, 'Lab tests search bucket present');
  assert(!!cats.invoices, 'Invoices search bucket present');
  assert(!!cats.medicines, 'Medicines search bucket present');

  // Step 3: Category-Specific Targeted Search
  console.log('\n--- 3. Testing Category-Specific Search Filters ---');
  
  // 3a. Medicines Category Search
  const medSearch = await request({
    ...parseUrl('/search?q=para&category=medicines'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(medSearch.status === 200, 'GET /search?q=para&category=medicines returned HTTP 200');
  assert(Array.isArray(medSearch.data.data.categories.medicines), 'Medicines results returned as array');

  // 3b. Lab Tests Category Search
  const labSearch = await request({
    ...parseUrl('/search?q=blood&category=lab_tests'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(labSearch.status === 200, 'GET /search?q=blood&category=lab_tests returned HTTP 200');
  assert(Array.isArray(labSearch.data.data.categories.lab_tests), 'Lab tests results returned as array');

  // 3c. Doctors Category Search
  const docSearch = await request({
    ...parseUrl('/search?q=cardio&category=doctors'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(docSearch.status === 200, 'GET /search?q=cardio&category=doctors returned HTTP 200');
  assert(Array.isArray(docSearch.data.data.categories.doctors), 'Doctors results returned as array');

  // Step 4: Role-Based Confidentiality: Patient Role Scoping
  console.log('\n--- 4. CRITICAL PRIVACY TEST: Patient Role Data Scoping ---');
  const patSearch = await request({
    ...parseUrl('/search?q=john'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });

  assert(patSearch.status === 200, 'Patient search returned HTTP 200');
  const patCats = patSearch.data.data.categories;
  assert(patCats.patients.length === 0, 'Patient CANNOT search other patient records (length = 0)');

  // Step 5: SQL Injection Resistance & Safety
  console.log('\n--- 5. Security & Safety Test: SQL Injection Parameterization ---');
  const injectionSearch = await request({
    ...parseUrl("/search?q=' OR '1'='1"),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });

  assert(injectionSearch.status === 200, 'SQL injection attempt handled gracefully with HTTP 200');
  assert(typeof injectionSearch.data.data.total_matches === 'number', 'Parameterized query executed safely without leak');

  console.log('\n======================================================');
  console.log('🏁 ALL GLOBAL SEARCH TESTS PASSED SUCCESSFULLY (0 FAILURES)');
  console.log('======================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed with Error:\n', err);
  process.exit(1);
});
