const db = require('../server/config/db');
const doctorService = require('../server/services/doctor.service');

async function runDoctorIntegrationTests() {
  console.log('🧪 Starting Doctor Management Module Integration Tests...\n');
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

  try {
    // Test 1: Fetch all doctors with pagination
    console.log('--- Test Suite 1: Doctor Retrieval & Multi-Criteria Filtering ---');
    const result1 = await doctorService.getDoctors({}, { page: 1, limit: 10 });
    assert(result1.doctors.length >= 8, 'Retrieves at least 8 seeded specialized doctors');
    assert(result1.pagination.total >= 8, 'Pagination total count matches');
    assert(result1.doctors[0].schedules.length > 0, 'Doctor schedules are attached to doctor records');

    // Test 2: Filter by department (Cardiology = id 1)
    const cardDoctors = await doctorService.getDoctors({ department_id: 1 }, { page: 1, limit: 10 });
    assert(cardDoctors.doctors.length > 0, 'Filters doctors by department ID');
    assert(cardDoctors.doctors.every(d => d.department_id === 1), 'All returned doctors belong to Cardiology');

    // Test 3: Search by keyword
    const searchResult = await doctorService.getDoctors({ search: 'Elena' }, { page: 1, limit: 10 });
    assert(searchResult.doctors.length === 1, 'Search finds Dr. Elena Rostova');
    assert(searchResult.doctors[0].doctor_code === 'DOC-2026-0002', 'Doctor code matches DOC-2026-0002');

    // Test 4: Get Detailed Doctor Profile by ID
    console.log('\n--- Test Suite 2: Doctor Profile & Schedules ---');
    const doctorProfile = await doctorService.getDoctorById(1);
    assert(doctorProfile !== null, 'Fetches detailed doctor profile by ID 1');
    assert(doctorProfile.doctor_code === 'DOC-2026-0001', 'Doctor profile includes doctor_code');
    assert(doctorProfile.department_name === 'Cardiology', 'Doctor profile includes joined department name');
    assert(Array.isArray(doctorProfile.schedules), 'Doctor profile includes schedules array');
    assert(typeof doctorProfile.stats === 'object', 'Doctor profile includes consultation stats');

    // Test 5: Create New Doctor with auto-generated Doctor Code & User Account
    console.log('\n--- Test Suite 3: Doctor Creation & Account Provisioning ---');
    const testDocEmail = `test.physician.${Date.now()}@auracare.com`;
    const newDocData = {
      first_name: 'Dr. Gregory',
      last_name: 'House',
      email: testDocEmail,
      phone: '+1 (555) 999-8877',
      department_id: 2, // Neurology
      specialization: 'Diagnostic Medicine & Nephrology',
      qualification: 'MD, Board Certified Diagnostics',
      licenseNumber: 'MD-DIAG-00771',
      experienceYears: 20,
      consultationFee: 250.00,
      roomNumber: 'Diagnostics Lab 1',
      bio: 'Head of Diagnostic Medicine specializing in rare and complex etiologies.',
      status: 'active',
      schedules: [
        { day_of_week: 'Monday', start_time: '10:00:00', end_time: '15:00:00', slot_duration_minutes: 30, max_patients: 10, is_active: true },
        { day_of_week: 'Wednesday', start_time: '10:00:00', end_time: '15:00:00', slot_duration_minutes: 30, max_patients: 10, is_active: true }
      ]
    };

    const mockAdmin = { id: 1, role: 'super_admin' };
    const createdDoctor = await doctorService.createDoctor(newDocData, mockAdmin);
    assert(createdDoctor !== null, 'New doctor created successfully');
    assert(createdDoctor.doctor_code.startsWith('DOC-2026-'), 'Doctor code automatically generated with correct prefix');
    assert(createdDoctor.name === 'Dr. Gregory House', 'User full name saved correctly');
    assert(createdDoctor.schedules.length === 2, 'Doctor schedules initialized correctly');

    // Verify user record in database
    const [userRows] = await db.query('SELECT * FROM users WHERE id = ?', [createdDoctor.user_id]);
    assert(userRows.length === 1 && userRows[0].role_id === 3, 'Linked user account has role_id 3 (doctor)');

    // Test 6: Update Doctor Details & Consultation Fee
    console.log('\n--- Test Suite 4: Doctor Updates, Status & Schedules ---');
    const updatedDoctor = await doctorService.updateDoctor(
      createdDoctor.id,
      { consultation_fee: 300.00, room_number: 'Office 401-Diagnostic Suite' },
      mockAdmin
    );
    assert(parseFloat(updatedDoctor.consultation_fee) === 300.00, 'Consultation fee updated to $300.00');
    assert(updatedDoctor.room_number === 'Office 401-Diagnostic Suite', 'Room number updated');

    // Test 7: Update Doctor Status
    const statusResult = await doctorService.updateDoctorStatus(createdDoctor.id, 'on_leave', mockAdmin);
    assert(statusResult.status === 'on_leave' && statusResult.is_available === 0, 'Doctor status updated to on_leave and unavailable');

    // Test 8: Bulk Update Doctor Weekly Schedules
    const updatedSchedules = await doctorService.updateDoctorSchedules(
      createdDoctor.id,
      [
        { day_of_week: 'Friday', start_time: '12:00:00', end_time: '17:00:00', slot_duration_minutes: 20, max_patients: 15, is_active: true }
      ],
      mockAdmin
    );
    assert(updatedSchedules.some(s => s.day_of_week === 'Friday'), 'Friday shift added to doctor schedule');

    // Test 9: Get Aggregated Stats
    const stats = await doctorService.getDoctorStats();
    assert(stats.total_doctors >= 9, 'Aggregated stats count includes created doctor');
    assert(parseFloat(stats.avg_consultation_fee) > 0, 'Average consultation fee calculated');

    // Clean up created test doctor
    await db.query('DELETE FROM doctor_schedules WHERE doctor_id = ?', [createdDoctor.id]);
    await db.query('DELETE FROM doctors WHERE id = ?', [createdDoctor.id]);
    await db.query('DELETE FROM users WHERE id = ?', [createdDoctor.user_id]);
    console.log('\n🧹 Test doctor cleaned up.');

    console.log('\n======================================================');
    console.log(`🏁 DOCTOR MODULE INTEGRATION TEST RESULTS:`);
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

runDoctorIntegrationTests();
