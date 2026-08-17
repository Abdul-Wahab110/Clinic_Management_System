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

async function runRbacMatrixTest() {
  console.log('====================================================');
  console.log('🛡️ TESTING RBAC ROLE-PERMISSION MATRIX & PERSISTENCE');
  console.log('====================================================\n');

  // 1. Authenticate Super Admin
  console.log('--- 1. Authenticating Super Admin ---');
  const loginRes = await sendReq('POST', '/api/v1/auth/login', {
    email: 'superadmin@auracare.com',
    password: 'Clinic2026!'
  });
  console.log('Login Response:', loginRes);
  assert(loginRes.status === 200, 'Super Admin logged in');
  const token = loginRes.data.data.token;

  // 2. Fetch Matrix
  console.log('\n--- 2. Fetching Role-Permission Matrix ---');
  const matrixRes = await sendReq('GET', '/api/v1/admin/matrix', null, token);
  assert(matrixRes.status === 200, 'Matrix fetched successfully');
  assert(Array.isArray(matrixRes.data.data.roles), 'Roles array present in matrix');
  assert(Array.isArray(matrixRes.data.data.permissions), 'Permissions array present in matrix');
  assert(matrixRes.data.data.permissions.length > 0, `Found ${matrixRes.data.data.permissions.length} total permissions`);

  // Verify Super Admin has all permissions
  const superAdminRole = matrixRes.data.data.matrix.find(m => m.name === 'super_admin');
  assert(superAdminRole !== undefined, 'Super admin found in matrix');
  const grantedCount = superAdminRole.permissions.filter(p => p.granted).length;
  assert(grantedCount === matrixRes.data.data.permissions.length, `Super Admin has 100% permissions granted (${grantedCount}/${matrixRes.data.data.permissions.length})`);

  // 3. Test Updating Single Role Permissions (e.g. Receptionist role_id = 4)
  console.log('\n--- 3. Testing Single Role Permissions Update ---');
  const [recPerms] = await pool.query(`SELECT id FROM permissions WHERE code IN ('patients.view', 'patients.create', 'appointments.view', 'appointments.create')`);
  const recPermIds = recPerms.map(p => p.id);

  const updateRecRes = await sendReq('PUT', '/api/v1/admin/roles/4/permissions', {
    permission_ids: recPermIds
  }, token);
  assert(updateRecRes.status === 200, 'Receptionist permissions updated successfully');
  assert(updateRecRes.data.data.permissions.length === recPermIds.length, `Receptionist has exactly ${recPermIds.length} permissions`);

  // 4. Test Bulk Update Full Matrix (PUT /api/v1/admin/matrix)
  console.log('\n--- 4. Testing Atomic Full Matrix Update ---');
  const [docPerms] = await pool.query(`SELECT id FROM permissions WHERE module IN ('appointments', 'patients', 'medical_records', 'prescriptions', 'lab')`);
  const docPermIds = docPerms.map(p => p.id);

  const bulkMatrixRes = await sendReq('PUT', '/api/v1/admin/matrix', {
    assignments: {
      3: docPermIds, // Doctor
      4: recPermIds  // Receptionist
    }
  }, token);
  assert(bulkMatrixRes.status === 200, 'Full matrix bulk update successful');

  // Verify in database
  const [docDbPerms] = await pool.query('SELECT COUNT(*) as count FROM role_permissions WHERE role_id = 3');
  assert(docDbPerms[0].count === docPermIds.length, `Doctor has ${docDbPerms[0].count} permissions persisted in MySQL`);

  // 5. Test Creating a Custom Role
  console.log('\n--- 5. Testing Custom Role Creation ---');
  const testRoleName = 'test_triage_specialist_' + Date.now();
  const createRoleRes = await sendReq('POST', '/api/v1/admin/roles', {
    name: testRoleName,
    display_name: 'Triage Specialist',
    description: 'Handles patient triage and queue allocation'
  }, token);
  assert(createRoleRes.status === 201, 'Custom role created (HTTP 201)');
  const createdRoleId = createRoleRes.data.data.id;

  // Clean up custom test role
  await pool.query('DELETE FROM roles WHERE id = ?', [createdRoleId]);

  console.log('\n====================================================');
  console.log('🏁 ALL RBAC MATRIX TESTS PASSED (0 FAILURES)');
  console.log('====================================================\n');
  process.exit(0);
}

runRbacMatrixTest().catch(e => {
  console.error(e);
  process.exit(1);
});
