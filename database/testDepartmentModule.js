const db = require('../server/config/db');
const departmentService = require('../server/services/department.service');

async function runDepartmentIntegrationTests() {
  console.log('🧪 Starting Hospital Department Management Module Integration Tests...\n');
  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      testsFailed++;
    }
  }

  const mockAdmin = { id: 1, role: 'super_admin' };

  try {
    // 1. Test Retrieve All Departments
    console.log('--- Test Suite 1: Department Retrieval & Filter ---');
    const listResult = await departmentService.getDepartments({}, { page: 1, limit: 30 });
    assert(listResult.departments.length >= 12, 'Retrieves all 12+ seeded hospital departments');
    assert(listResult.pagination.total >= 12, 'Pagination metadata matches');
    assert(listResult.departments.some(d => d.code === 'CARD' && d.doctors_count >= 1), 'Cardiology has attached doctor count');
    assert(listResult.departments.some(d => d.code === 'CARD' && d.head_doctor_name !== null), 'Cardiology includes assigned Head Doctor');

    // 2. Test Filter & Search
    const searchResult = await departmentService.getDepartments({ search: 'Neurology' }, { page: 1, limit: 10 });
    assert(searchResult.departments.length === 1 && searchResult.departments[0].code === 'NEUR', 'Search finds Neurology department by name');

    const erResult = await departmentService.getDepartments({ emergency_only: true }, { page: 1, limit: 20 });
    assert(erResult.departments.length >= 4, 'Filters emergency 24/7 departments');
    assert(erResult.departments.every(d => d.emergency_available === 1), 'All returned departments have emergency_available = 1');

    // 3. Test View Department by ID / Code
    console.log('\n--- Test Suite 2: Department Detailed Profile & Assigned Doctors ---');
    const cardioDept = await departmentService.getDepartmentById('CARD');
    assert(cardioDept !== null, 'Fetches department by code "CARD"');
    assert(cardioDept.name === 'Cardiology', 'Department name is Cardiology');
    assert(Array.isArray(cardioDept.doctors), 'Department profile includes assigned doctors array');
    assert(cardioDept.doctors.length >= 1, 'Cardiology has at least 1 assigned physician');
    assert(cardioDept.doctors[0].schedules.length > 0, 'Assigned physician includes weekly duty schedules');
    assert(typeof cardioDept.stats === 'object', 'Department profile includes clinical statistics object');

    // 4. Test Dynamic Department Creation
    console.log('\n--- Test Suite 3: Dynamic Department Creation & Validation ---');
    const dynamicCode = `TEST_${Date.now().toString().slice(-4)}`;
    const newDeptData = {
      name: `Integrative Wellness & Rehabilitation ${dynamicCode}`,
      code: dynamicCode,
      description: 'Holistic rehabilitation, acupuncture, physical therapy, and restorative wellness.',
      icon: 'fa-spa',
      floor_location: 'Pavilion C, Level 3',
      phone: '+1 (555) 999-3322',
      email: `wellness.${dynamicCode.toLowerCase()}@auracare.com`,
      emergency_available: 0,
      consultation_base_fee: 85.00,
      is_active: 1
    };

    const createdDept = await departmentService.createDepartment(newDeptData, mockAdmin);
    assert(createdDept !== null && createdDept.id > 0, 'New department created dynamically in MySQL');
    assert(createdDept.code === dynamicCode, 'Department code matches input');
    assert(parseFloat(createdDept.consultation_base_fee) === 85.00, 'Consultation base fee matches');

    // Test Duplicate Code Validation
    let duplicateRejected = false;
    try {
      await departmentService.createDepartment(newDeptData, mockAdmin);
    } catch (err) {
      if (err.statusCode === 409) duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate department code is rejected with 409 Conflict');

    // 5. Test Update Department Configuration
    console.log('\n--- Test Suite 4: Department Updates, Status & Doctor Assignment ---');
    const updatedDept = await departmentService.updateDepartment(
      createdDept.id,
      { consultation_base_fee: 105.00, floor_location: 'Pavilion C, Level 4 (Expanded Wing)' },
      mockAdmin
    );
    assert(parseFloat(updatedDept.consultation_base_fee) === 105.00, 'Consultation base fee updated to $105.00');
    assert(updatedDept.floor_location === 'Pavilion C, Level 4 (Expanded Wing)', 'Floor location updated');

    // 6. Test Status Toggle
    const statusResult = await departmentService.updateDepartmentStatus(createdDept.id, false, mockAdmin);
    assert(statusResult.is_active === 0, 'Department deactivated (is_active = 0)');
    const reactivateResult = await departmentService.updateDepartmentStatus(createdDept.id, true, mockAdmin);
    assert(reactivateResult.is_active === 1, 'Department reactivated (is_active = 1)');

    // 7. Test Doctor Assignment & Department Doctors Query
    const [firstDoc] = await db.query('SELECT id, department_id FROM doctors LIMIT 1');
    const origDeptId = firstDoc[0].department_id;
    const testDocId = firstDoc[0].id;

    await departmentService.assignDoctorToDepartment(createdDept.id, testDocId, mockAdmin);
    const assignedDocs = await departmentService.getDepartmentDoctors(createdDept.id);
    assert(assignedDocs.some(d => d.id === testDocId), 'Doctor successfully assigned to new department');

    // 8. Test Safe Deletion Protection (Cannot delete while doctors are assigned)
    console.log('\n--- Test Suite 5: Dependency-Safe Deletion & Transfer ---');
    let deleteBlocked = false;
    try {
      await departmentService.deleteDepartment(createdDept.id, null, mockAdmin);
    } catch (err) {
      if (err.statusCode === 400 && err.details?.requiresReassignment) {
        deleteBlocked = true;
      }
    }
    assert(deleteBlocked, 'Unsafe deletion blocked when doctors are assigned (requires fallback transfer)');

    // Safe deletion with fallback reassignment
    const deleteResult = await departmentService.deleteDepartment(createdDept.id, origDeptId, mockAdmin);
    assert(deleteResult.success === true, 'Department deleted safely and doctors transferred to fallback department');

    // 9. Test Aggregated Department KPIs
    console.log('\n--- Test Suite 6: Aggregated Department KPIs ---');
    const stats = await departmentService.getDepartmentStats();
    assert(stats.total_departments >= 12, 'Aggregated department count is at least 12');
    assert(stats.active_departments >= 12, 'Active department count calculated');
    assert(stats.emergency_units >= 4, '24/7 Emergency units calculated');
    assert(stats.total_assigned_doctors >= 8, 'Total assigned doctors calculated');

    console.log('\n======================================================');
    console.log(`🏁 DEPARTMENT MODULE INTEGRATION TEST RESULTS:`);
    console.log(`   Passed: ${testsPassed}`);
    console.log(`   Failed: ${testsFailed}`);
    console.log('======================================================\n');

    if (testsFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Test execution error:', err);
    process.exit(1);
  }
}

runDepartmentIntegrationTests();
