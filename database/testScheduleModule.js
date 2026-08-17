const db = require('../server/config/db');
const scheduleService = require('../server/services/schedule.service');

async function runScheduleIntegrationTests() {
  console.log('🧪 Starting Doctor Schedule & Availability Module Integration Tests...\n');
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
    // Test 1: Calculate Real Availability for a Working Day (Monday: 2026-09-07)
    console.log('--- Test Suite 1: Live Real Availability & Slot Generation ---');
    // Dr. Marcus Vance (ID 1) works Mon-Fri 09:00-14:00 with 20min slots and break 13:00-14:00
    const availResult = await scheduleService.calculateDoctorAvailability(1, '2026-09-07');
    assert(availResult.doctor_id === 1, 'Availability returns correct doctor ID');
    assert(availResult.day_of_week === 'Monday', 'Calculates correct day of week (Monday)');
    assert(availResult.is_available === true, 'Doctor is marked available on working day');
    assert(availResult.slots.length > 0, 'Generated actual distinct time slots');
    assert(availResult.slots[0].time === '09:00', 'First slot starts at 09:00');
    assert(availResult.slots[0].end_time === '09:20', 'First slot ends at 09:20 with 20min duration');
    
    // Verify break times are flagged
    const breakSlot = availResult.slots.find(s => s.time === '13:00');
    if (breakSlot) {
      assert(breakSlot.is_break === true && breakSlot.is_available === false, 'Break time (13:00-14:00) is marked unavailable');
    }

    // Test 2: Calculate Availability for an Off Day (Sunday: 2026-08-30)
    console.log('\n--- Test Suite 2: Off-Day & Closed Clinical Shift Calculation ---');
    const offDayResult = await scheduleService.calculateDoctorAvailability(1, '2026-08-30');
    assert(offDayResult.is_available === false, 'Doctor marked unavailable on off-day (Sunday)');
    assert(offDayResult.slots.length === 0, 'Zero slots generated on off-day');
    assert(offDayResult.reason.includes('Sunday'), 'Reason specifies no scheduled clinic on Sundays');

    // Test 3: Approved Leave and Blocked Dates
    console.log('\n--- Test Suite 3: Leave & Blocked Date Handling ---');
    // Seed a specific test leave for Dr. Marcus Vance on 2026-09-14 (Monday)
    await db.query(`
      INSERT INTO doctor_leaves (doctor_id, start_date, end_date, leave_type, reason, is_full_day, status)
      VALUES (1, '2026-09-14', '2026-09-14', 'conference', 'Cardiology Research Conference', 1, 'approved')
    `);

    const leaveAvailResult = await scheduleService.calculateDoctorAvailability(1, '2026-09-14');
    assert(leaveAvailResult.is_available === false, 'Doctor on approved leave is marked unavailable');
    assert(leaveAvailResult.reason.includes('CONFERENCE'), 'Reason includes conference leave tag');
    assert(leaveAvailResult.slots.length === 0, 'Zero available slots on full-day leave');

    // Clean up test leave
    await db.query('DELETE FROM doctor_leaves WHERE doctor_id = 1 AND start_date = "2026-09-14"');

    // Test 4: Existing Booked Appointments are Excluded
    console.log('\n--- Test Suite 4: Real Booked Appointment Collision Avoidance ---');
    // Create a temporary appointment for Dr. Marcus Vance at 09:40 on 2026-09-07
    await db.query(`
      INSERT INTO appointments 
      (appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason)
      VALUES ('TEST-APT-BOOKED', 1, 1, 1, '2026-09-07', '09:40:00', 'consultation', 'confirmed', 'Test booked slot')
    `);

    const collisionAvail = await scheduleService.calculateDoctorAvailability(1, '2026-09-07');
    const bookedSlot = collisionAvail.slots.find(s => s.time === '09:40');
    assert(bookedSlot !== undefined, 'Found slot 09:40 in generated slots');
    assert(bookedSlot.is_booked === true && bookedSlot.is_available === false, 'Booked slot 09:40 is marked is_booked: true and is_available: false');
    assert(!collisionAvail.available_slots.includes('09:40'), 'Booked slot 09:40 is excluded from available_slots list');

    // Clean up test appointment
    await db.query('DELETE FROM appointments WHERE appointment_number = "TEST-APT-BOOKED"');

    // Test 5: Batch Update Doctor Schedules with Break Times & Quotas
    console.log('\n--- Test Suite 5: Batch Schedule Updates & Validation ---');
    const updatedSchedules = await scheduleService.updateDoctorSchedules(
      1,
      [
        {
          day_of_week: 'Monday',
          start_time: '08:30:00',
          end_time: '15:30:00',
          break_start_time: '12:30:00',
          break_end_time: '13:30:00',
          slot_duration_minutes: 30,
          max_patients: 18,
          is_active: true
        }
      ],
      mockAdmin
    );
    const monSched = updatedSchedules.find(s => s.day_of_week === 'Monday');
    assert(monSched.start_time.startsWith('08:30'), 'Start time updated to 08:30');
    assert(monSched.slot_duration_minutes === 30, 'Slot duration updated to 30 minutes');
    assert(monSched.break_start_time.startsWith('12:30'), 'Break start time updated to 12:30');

    // Restore original Monday schedule
    await scheduleService.updateDoctorSchedules(
      1,
      [
        {
          day_of_week: 'Monday',
          start_time: '09:00:00',
          end_time: '14:00:00',
          break_start_time: '13:00:00',
          break_end_time: '14:00:00',
          slot_duration_minutes: 20,
          max_patients: 15,
          is_active: true
        }
      ],
      mockAdmin
    );

    // Test 6: Doctor Leaves Application & Conflicting Appointments Detection
    console.log('\n--- Test Suite 6: Doctor Leave Application & Workflow ---');
    const leaveAppResult = await scheduleService.applyDoctorLeave(
      {
        doctor_id: 2,
        start_date: '2026-10-05',
        end_date: '2026-10-07',
        leave_type: 'sick',
        reason: 'Medical recovery leave',
        is_full_day: true,
        status: 'pending'
      },
      mockAdmin
    );
    assert(leaveAppResult.leave !== undefined, 'Leave record created');
    assert(leaveAppResult.leave.status === 'pending', 'Leave status initialized as pending');

    // Approve leave
    const approveResult = await scheduleService.updateLeaveStatus(leaveAppResult.leave.id, 'approved', mockAdmin);
    assert(approveResult.status === 'approved', 'Leave approved successfully');

    // Clean up created leave
    await db.query('DELETE FROM doctor_leaves WHERE id = ?', [leaveAppResult.leave.id]);

    // Test 7: Master 7-Day Timetable Matrix Overview
    console.log('\n--- Test Suite 7: Master 7-Day Timetable Matrix Overview ---');
    const overview = await scheduleService.getAllSchedulesOverview();
    assert(overview.length >= 8, 'Overview includes all active faculty doctors');
    assert(overview[0].week_schedule !== undefined, 'Doctor object has full 7-day schedule map');
    assert(typeof overview[0].week_schedule.Monday === 'object', 'Monday shift object present');

    console.log('\n======================================================');
    console.log(`🏁 SCHEDULE MODULE INTEGRATION TEST RESULTS:`);
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

runScheduleIntegrationTests();
