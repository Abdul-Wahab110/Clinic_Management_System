const db = require('../server/config/db');
const staffService = require('../server/services/staff.service');

async function runStaffIntegrationTests() {
  console.log('🧪 Starting Hospital Staff Management Module Integration Tests...\n');
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

  const mockAdmin = { id: 1, role: 'hospital_admin' };

  try {
    // Test Suite 1: Staff Directory & Multi-Role Querying
    console.log('--- Test Suite 1: Staff Directory & Multi-Role Querying ---');
    const staffList = await staffService.listStaff({});
    assert(staffList.staff.length >= 10, 'Retrieves all hospital staff profiles from MySQL');
    assert(staffList.staff.some(s => s.staff_type === 'doctor'), 'Includes Doctors');
    assert(staffList.staff.some(s => s.staff_type === 'nurse'), 'Includes Nurses');
    assert(staffList.staff.some(s => s.staff_type === 'pharmacist'), 'Includes Pharmacists');
    assert(staffList.staff.some(s => s.staff_type === 'lab_technician'), 'Includes Lab Technicians');
    assert(staffList.staff.some(s => s.staff_type === 'accountant'), 'Includes Accountants');
    assert(staffList.staff.some(s => s.staff_type === 'receptionist'), 'Includes Receptionists');

    // Filter by staff type: Doctor
    const docOnly = await staffService.listStaff({ staff_type: 'doctor' });
    assert(docOnly.staff.every(s => s.staff_type === 'doctor'), 'Filters staff by role: doctor');

    // Test Suite 2: Detailed Staff Profile Retrieval
    console.log('\n--- Test Suite 2: Detailed Staff Profile Retrieval ---');
    const firstStaff = staffList.staff[0];
    const profile = await staffService.getStaffById(firstStaff.id);
    assert(profile.id === firstStaff.id, 'Staff profile retrieved by ID');
    assert(profile.hasOwnProperty('employee_id'), 'Profile includes Employee ID');
    assert(profile.hasOwnProperty('designation'), 'Profile includes professional designation');
    assert(profile.hasOwnProperty('department_name'), 'Profile includes joined department name');
    assert(profile.hasOwnProperty('email'), 'Profile connected to authentication user email');

    // Test Suite 3: Onboarding New Staff & Authentication Provisioning
    console.log('\n--- Test Suite 3: Onboarding New Staff & Authentication Provisioning ---');
    const newNurseRes = await staffService.addStaff({
      full_name: 'Nurse Benjamin Cross',
      email: 'benjamin.cross.test@auracare.com',
      password: 'SecurePassword2026!',
      phone: '+1 555-019-2831',
      staff_type: 'nurse',
      designation: 'Critical Care Trauma Nurse Specialist',
      department_id: 12, // Emergency
      joining_date: '2026-03-01',
      qualification: 'BSN, RN, Certified Emergency Nurse (CEN)',
      salary_monthly: 6500.00,
      emergency_contact: 'Amanda Cross (Spouse)',
      emergency_phone: '+1 555-019-2832',
      status: 'active'
    }, mockAdmin);

    assert(newNurseRes.id > 0, 'New nurse staff member created in staff_profiles');
    assert(newNurseRes.user_id > 0, 'User account automatically provisioned in users table');
    assert(newNurseRes.employee_id.startsWith('EMP-'), 'Unique Employee ID generated (EMP-YYYY-XXXXXX)');

    // Verify user exists in users table with role_id 5 (nurse)
    const [uCheck] = await db.query('SELECT role_id, email, status FROM users WHERE id = ?', [newNurseRes.user_id]);
    assert(uCheck.length > 0 && uCheck[0].role_id === 5, 'Linked user has role_id 5 (nurse)');
    assert(uCheck[0].status === 'active', 'User account is active');

    // Test Suite 4: Onboarding New Doctor with Auto-Doctor Record Provisioning
    console.log('\n--- Test Suite 4: Onboarding New Doctor ---');
    const newDocRes = await staffService.addStaff({
      full_name: 'Dr. Gregory Vance Jr.',
      email: 'gregory.vance.test@auracare.com',
      password: 'SecurePassword2026!',
      phone: '+1 555-019-4455',
      staff_type: 'doctor',
      designation: 'Fellowship Trained Interventional Cardiologist',
      department_id: 1, // Cardiology
      joining_date: '2026-02-15',
      qualification: 'MD, FACC, Board Certified Cardiologist',
      consultation_fee: 250.00,
      experience_years: 10,
      salary_monthly: 18500.00,
      status: 'active'
    }, mockAdmin);

    assert(newDocRes.id > 0, 'New doctor staff profile created');
    const [docCheck] = await db.query('SELECT doctor_code, department_id, specialization FROM doctors WHERE user_id = ?', [newDocRes.user_id]);
    assert(docCheck.length > 0 && docCheck[0].doctor_code.startsWith('DOC-'), 'Doctor table entry auto-provisioned (DOC-YYYY-XXXX)');

    // Duplicate email conflict prevention
    let duplicateBlocked = false;
    try {
      await staffService.addStaff({
        full_name: 'Duplicate Doctor',
        email: 'gregory.vance.test@auracare.com',
        staff_type: 'doctor',
        designation: 'Cardiologist'
      }, mockAdmin);
    } catch (err) {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, 'BLOCKED: Duplicate email rejected with 409 Conflict');

    // Test Suite 5: Staff Profile Edit & Authentication Sync
    console.log('\n--- Test Suite 5: Staff Profile Edit & Authentication Sync ---');
    const updateRes = await staffService.updateStaff(newNurseRes.id, {
      full_name: 'Nurse Benjamin Cross (Senior Lead)',
      phone: '+1 555-019-9999',
      designation: 'Senior Lead Emergency Nurse Coordinator',
      salary_monthly: 7200.00
    }, mockAdmin);
    assert(updateRes.id === newNurseRes.id, 'Staff profile updated successfully');

    const updatedProfile = await staffService.getStaffById(newNurseRes.id);
    assert(updatedProfile.full_name === 'Nurse Benjamin Cross (Senior Lead)', 'Full name updated in users table');
    assert(updatedProfile.phone === '+1 555-019-9999', 'Phone updated in users table');
    assert(updatedProfile.designation === 'Senior Lead Emergency Nurse Coordinator', 'Designation updated in staff_profiles');
    assert(parseFloat(updatedProfile.salary_monthly) === 7200.00, 'Monthly salary updated');

    // Test Suite 6: Status Toggle (Active <-> On Leave <-> Inactive)
    console.log('\n--- Test Suite 6: Status Toggle ---');
    const leaveRes = await staffService.updateStaffStatus(newNurseRes.id, 'on_leave', mockAdmin);
    assert(leaveRes.status === 'on_leave', 'Staff status updated to ON_LEAVE');

    const deactRes = await staffService.updateStaffStatus(newNurseRes.id, 'inactive', mockAdmin);
    assert(deactRes.status === 'inactive', 'Staff status updated to INACTIVE');

    // Verify user account is deactivated
    const [uDeact] = await db.query('SELECT status FROM users WHERE id = ?', [newNurseRes.user_id]);
    assert(uDeact[0].status === 'inactive', 'Linked user account synchronized to INACTIVE');

    const reactRes = await staffService.updateStaffStatus(newNurseRes.id, 'active', mockAdmin);
    assert(reactRes.status === 'active', 'Staff status reactivated to ACTIVE');

    // Test Suite 7: Department Assignment & Transfer
    console.log('\n--- Test Suite 7: Department Assignment & Transfer ---');
    const deptTransferRes = await staffService.assignDepartment(newNurseRes.id, 2, mockAdmin); // Neurology
    assert(deptTransferRes.department_id === 2, 'Staff re-assigned to Department 2');

    const checkTransfer = await staffService.getStaffById(newNurseRes.id);
    assert(checkTransfer.department_id === 2, 'Department ID matches Neurology');

    // Test Suite 8: Staff Aggregate KPIs & Analytics
    console.log('\n--- Test Suite 8: Staff Aggregate KPIs & Analytics ---');
    const stats = await staffService.getStaffStats();
    assert(stats.total_staff >= 12, 'Total staff count calculated');
    assert(stats.active_staff >= 10, 'Active staff count calculated');
    assert(stats.doctors_count >= 5, 'Doctors count calculated');
    assert(stats.nurses_count >= 2, 'Nurses count calculated');
    assert(Array.isArray(stats.departments_breakdown), 'Departments staff breakdown generated');

    // Clean up test staff records
    await db.query('DELETE FROM doctors WHERE user_id = ?', [newDocRes.user_id]);
    await db.query('DELETE FROM staff_profiles WHERE id IN (?, ?)', [newNurseRes.id, newDocRes.id]);
    await db.query('DELETE FROM users WHERE id IN (?, ?)', [newNurseRes.user_id, newDocRes.user_id]);

    console.log('\n======================================================');
    console.log(`🏁 STAFF MODULE INTEGRATION TEST RESULTS:`);
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

runStaffIntegrationTests();
