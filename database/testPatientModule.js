require('dotenv').config();
const http = require('http');
const serverModule = require('../server/server');
const app = serverModule.app || serverModule;
const jwt = require('jsonwebtoken');
const config = require('../server/config/env');
const db = require('../server/config/db');

async function runTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 COMPREHENSIVE TEST SUITE: PATIENT MANAGEMENT MODULE');
  console.log('🧪 ========================================================');

  // Start test server on dynamic port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // Generate Admin JWT Token
  const adminToken = jwt.sign(
    { userId: 1, email: 'superadmin@auracare.com', role: 'super_admin' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  // Generate Patient Arthur Pendleton JWT Token (User ID 10, Patient ID 1)
  const patientToken = jwt.sign(
    { userId: 10, email: 'patient@auracare.com', role: 'patient' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  // Helper HTTP request function
  function makeRequest(method, endpoint, body = null, token = adminToken) {
    return new Promise((resolve, reject) => {
      const url = new URL(`${baseUrl}${endpoint}`);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} - ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Test List & Pagination
    console.log('\n--- 1. Testing List Patients & Pagination ---');
    const listRes = await makeRequest('GET', '/patients?page=1&limit=3');
    assert(listRes.status === 200, 'GET /patients status is 200');
    assert(listRes.body.success === true, 'Response indicates success');
    assert(Array.isArray(listRes.body.data) && listRes.body.data.length <= 3, 'Returns paginated records');
    assert(listRes.body.pagination.total >= 5, 'Returns total count in pagination metadata');
    assert(listRes.body.stats && listRes.body.stats.total_patients > 0, 'Returns summary stats');

    // 2. Test Search
    console.log('\n--- 2. Testing Search Functionality ---');
    const searchRes = await makeRequest('GET', '/patients?search=Arthur');
    assert(searchRes.status === 200, 'Search request status is 200');
    assert(searchRes.body.data.some(p => p.first_name === 'Arthur'), 'Found patient by first name');

    const searchCnicRes = await makeRequest('GET', '/patients?search=35201-7894561-3');
    assert(searchCnicRes.body.data.length > 0, 'Found patient by identification/CNIC');

    // 3. Test Filters & Sorting
    console.log('\n--- 3. Testing Filters & Sorting ---');
    const filterRes = await makeRequest('GET', '/patients?gender=female&status=active&blood_group=A+');
    assert(filterRes.status === 200, 'Filter request status is 200');
    assert(filterRes.body.data.every(p => p.gender === 'female' && p.blood_group === 'A+'), 'All returned records match filter criteria');

    const sortRes = await makeRequest('GET', '/patients?sortBy=first_name&sortOrder=ASC&limit=20');
    const names = sortRes.body.data.map(p => p.first_name.toLowerCase());
    const isSorted = names.slice(1).every((n, i) => names[i] <= n);
    assert(isSorted, 'Returned records are sorted alphabetically by first name');

    // 4. Test Register New Patient
    console.log('\n--- 4. Testing Register Patient (POST /patients) ---');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const newPatientData = {
      first_name: 'Genevieve',
      last_name: 'Beaumont',
      gender: 'female',
      date_of_birth: '1990-05-14',
      blood_group: 'AB+',
      phone: `+1 (555) 777-${randSuffix}`,
      email: `genevieve.beaumont.${randSuffix}@medtest.com`,
      address: '200 Lakefront Promenade, Chicago, IL 60611',
      identification_number: `55401-${randSuffix}76-2`,
      emergency_contact_name: 'Henri Beaumont',
      emergency_contact_phone: `+1 (555) 777-${randSuffix + 1}`,
      emergency_contact_relation: 'Spouse',
      allergies: 'Sulfa antibiotics (Urticaria)',
      medical_history: 'Mild allergic asthma, No past surgeries',
      status: 'active',
      occupation: 'Architectural Conservator',
      insurance_provider: 'Aetna Health Gold',
      insurance_policy_number: 'AET-774411'
    };

    const createRes = await makeRequest('POST', '/patients', newPatientData);
    assert(createRes.status === 201, 'Patient created with status 201');
    assert(createRes.body.data && createRes.body.data.patientCode.startsWith('PAT-'), 'Unique Patient Code generated: ' + createRes.body.data?.patientCode);
    const createdPatientId = createRes.body.data.id;

    // 5. Test Validation on Invalid Register
    console.log('\n--- 5. Testing Validation on Sensitive / Invalid Fields ---');
    const invalidRes = await makeRequest('POST', '/patients', { first_name: 'A' }); // missing fields
    assert(invalidRes.status === 422, 'Invalid registration rejected with 422 Unprocessable Entity');

    // 6. Test View Patient Details
    console.log('\n--- 6. Testing View Patient Profile (GET /patients/:id) ---');
    const viewRes = await makeRequest('GET', `/patients/${createdPatientId}`);
    assert(viewRes.status === 200, 'View patient status is 200');
    assert(viewRes.body.data.first_name === 'Genevieve', 'Patient name matches');
    assert(viewRes.body.data.allergies.includes('Sulfa'), 'Allergies retrieved correctly');
    assert(viewRes.body.data.metrics !== undefined, 'Summary metrics attached to profile');

    // 7. Test Edit Patient
    console.log('\n--- 7. Testing Edit Patient (PUT /patients/:id) ---');
    const updateRes = await makeRequest('PUT', `/patients/${createdPatientId}`, {
      occupation: 'Principal Architect & Historic Conservator',
      allergies: 'Sulfa antibiotics (Urticaria), Strawberries (Mild itch)'
    });
    assert(updateRes.status === 200, 'Update patient status is 200');
    assert(updateRes.body.data.occupation === 'Principal Architect & Historic Conservator', 'Occupation updated');
    assert(updateRes.body.data.allergies.includes('Strawberries'), 'Allergies updated');

    // 8. Test Activate / Deactivate Patient
    console.log('\n--- 8. Testing Activate / Deactivate Patient Status ---');
    const deactRes = await makeRequest('PATCH', `/patients/${createdPatientId}/status`, { status: 'inactive' });
    assert(deactRes.status === 200, 'Deactivate status returned 200');
    assert(deactRes.body.data.status === 'inactive', 'Patient status is now inactive');

    const reactRes = await makeRequest('PATCH', `/patients/${createdPatientId}/status`, { status: 'active' });
    assert(reactRes.status === 200, 'Reactivate status returned 200');
    assert(reactRes.body.data.status === 'active', 'Patient status restored to active');

    // 9. Test Patient Documents (Add, List, Delete)
    console.log('\n--- 9. Testing Patient Documents (Upload / Delete) ---');
    const docRes = await makeRequest('POST', `/patients/${createdPatientId}/documents`, {
      document_name: 'Baseline Spirometry Pulmonary Scan',
      document_type: 'Diagnostic Report',
      file_path: '/uploads/documents/genevieve_pulmonary_2026.pdf',
      file_size_kb: 450,
      notes: 'Normal FEV1/FVC ratio.'
    });
    assert(docRes.status === 201, 'Document created with status 201');
    const docId = docRes.body.data.id;

    const listDocsRes = await makeRequest('GET', `/patients/${createdPatientId}/documents`);
    assert(listDocsRes.body.data.some(d => d.id === docId), 'New document appears in patient documents list');

    const delDocRes = await makeRequest('DELETE', `/patients/${createdPatientId}/documents/${docId}`);
    assert(delDocRes.status === 200, 'Document deleted successfully');

    // 10. Test Medical Records, Prescriptions, and Vitals
    console.log('\n--- 10. Testing Medical Records (EMR), Prescriptions & Vitals ---');
    const mrRes = await makeRequest('POST', `/patients/${createdPatientId}/records`, {
      chief_complaint: 'Routine wellness physical exam and allergy review',
      diagnosis: 'Seasonal Allergic Rhinitis (J30.9)',
      clinical_notes: 'Bilateral turbinates mildly congested. Clear breath sounds throughout lung fields.',
      follow_up_date: '2027-05-14',
      prescriptions: [
        { medicine_name: 'Zyrtec (Cetirizine)', dosage: '10mg', frequency: 'Once daily in morning', duration: '60 Days' }
      ]
    });
    assert(mrRes.status === 201, 'Medical record created in EMR');

    const vitalsRes = await makeRequest('POST', `/patients/${createdPatientId}/vitals`, {
      systolic: 118,
      diastolic: 76,
      heart_rate: 68,
      temperature: 98.4,
      oxygen_saturation: 99,
      weight_kg: 62.0,
      height_cm: 168.0,
      blood_sugar: 94,
      notes: 'Resting vitals normal.'
    });
    assert(vitalsRes.status === 201, 'Vitals recorded successfully');
    assert(vitalsRes.body.data.bmi > 20 && vitalsRes.body.data.bmi < 24, 'BMI calculated automatically: ' + vitalsRes.body.data?.bmi);

    const rxRes = await makeRequest('POST', `/patients/${createdPatientId}/prescriptions`, {
      medicine_name: 'Flonase (Fluticasone Propionate)',
      dosage: '50mcg/spray',
      frequency: '2 sprays per nostril once daily',
      duration: '60 Days',
      instructions: 'Shake gently before use.'
    });
    assert(rxRes.status === 201, 'Prescription added');

    // 11. Test Lab Reports, Invoices & Payments sub-resource endpoints
    console.log('\n--- 11. Testing Sub-Resource Endpoints on Patient 1 ---');
    const [pat1Appts, pat1Visits, pat1Labs, pat1Invoices, pat1Payments] = await Promise.all([
      makeRequest('GET', '/patients/1/appointments'),
      makeRequest('GET', '/patients/1/visits'),
      makeRequest('GET', '/patients/1/lab-reports'),
      makeRequest('GET', '/patients/1/invoices'),
      makeRequest('GET', '/patients/1/payments')
    ]);

    assert(pat1Appts.status === 200 && pat1Appts.body.data.length > 0, 'Patient 1 appointments returned');
    assert(pat1Visits.status === 200 && pat1Visits.body.data.length > 0, 'Patient 1 visits returned');
    assert(pat1Labs.status === 200 && pat1Labs.body.data.length > 0, 'Patient 1 lab reports returned');
    assert(pat1Invoices.status === 200 && pat1Invoices.body.data.length > 0, 'Patient 1 invoices returned');
    assert(pat1Payments.status === 200 && pat1Payments.body.data.length > 0, 'Patient 1 payments returned');

    // 12. Security & Patient Data Isolation Test (CRITICAL)
    console.log('\n--- 12. CRITICAL SECURITY TEST: Patient Data Isolation ---');
    // Patient Arthur Pendleton (Patient ID 1) accesses his own profile -> Should SUCCEED (200)
    const ownRes = await makeRequest('GET', '/patients/1', null, patientToken);
    assert(ownRes.status === 200, 'Patient Arthur Pendleton can access his own profile (ID 1)');

    // Patient Arthur Pendleton tries to access Patient 2 (Eleanor Vance) -> Must FAIL (403 Forbidden)!
    const crossRes = await makeRequest('GET', '/patients/2', null, patientToken);
    assert(crossRes.status === 403, 'Patient Arthur Pendleton is FORBIDDEN (403) from accessing Patient 2 records');

    const crossRecordsRes = await makeRequest('GET', '/patients/2/records', null, patientToken);
    assert(crossRecordsRes.status === 403, 'Patient Arthur Pendleton is FORBIDDEN (403) from accessing Patient 2 medical records');

    const crossInvoicesRes = await makeRequest('GET', '/patients/2/invoices', null, patientToken);
    assert(crossInvoicesRes.status === 403, 'Patient Arthur Pendleton is FORBIDDEN (403) from accessing Patient 2 invoices');

    console.log('\n========================================================');
    console.log(`📊 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    server.close();
    if (failed > 0) process.exit(1);
    process.exit(0);

  } catch (err) {
    console.error('💥 Test suite runner error:', err);
    server.close();
    process.exit(1);
  }
}

if (require.main === module) {
  runTests();
}

module.exports = runTests;
