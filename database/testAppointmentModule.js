const db = require('../server/config/db');
const appointmentService = require('../server/services/appointment.service');

async function runAppointmentIntegrationTests() {
  console.log('🧪 Starting Appointment Management Module Integration Tests...\n');
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
  const mockDoctor = { id: 2, role: 'doctor' }; // linked to doctor
  const mockPatient1 = { id: 13, role: 'patient' }; // Arthur Pendleton
  const mockPatient2 = { id: 14, role: 'patient' }; // Eleanor Vance

  try {
    // Test Suite 1: List Appointments & Multi-Criteria Filtering
    console.log('--- Test Suite 1: Appointment Listing, Filters & Search ---');
    const listResult = await appointmentService.listAppointments({ page: 1, limit: 10 }, mockAdmin);
    assert(listResult.appointments.length > 0, 'Retrieves seeded appointments list');
    assert(listResult.pagination.total >= 10, 'Total count matches seeded records');
    assert(listResult.appointments[0].patient_name !== undefined, 'Appointment includes joined patient name');
    assert(listResult.appointments[0].doctor_name !== undefined, 'Appointment includes joined doctor name');
    assert(listResult.appointments[0].department_name !== undefined, 'Appointment includes joined department name');

    // Filter by Status: confirmed
    const confirmedList = await appointmentService.listAppointments({ status: 'confirmed' }, mockAdmin);
    assert(confirmedList.appointments.every(a => a.status === 'confirmed'), 'Status filter returns only confirmed appointments');

    // Filter by Doctor ID
    const doc1List = await appointmentService.listAppointments({ doctor_id: 1 }, mockAdmin);
    assert(doc1List.appointments.every(a => a.doctor_id === 1), 'Doctor filter returns only appointments for Doctor 1');

    // Search by patient name or appointment number
    const searchResult = await appointmentService.listAppointments({ search: 'Arthur' }, mockAdmin);
    assert(searchResult.appointments.some(a => a.patient_name.includes('Arthur')), 'Search finds appointments for patient Arthur');

    // Test Suite 2: Aggregated Appointment KPIs
    console.log('\n--- Test Suite 2: Aggregated Appointment Statistics ---');
    const stats = await appointmentService.getAppointmentStats(mockAdmin);
    assert(stats.total >= 10, 'Stats calculates total appointments count');
    assert(typeof stats.confirmed === 'number', 'Stats includes confirmed count');
    assert(typeof stats.checked_in === 'number', 'Stats includes checked_in count');
    assert(typeof stats.completed === 'number', 'Stats includes completed count');
    assert(typeof stats.today_total === 'number', 'Stats includes today total appointments');

    // Test Suite 3: Book Appointment & Double Booking Prevention
    console.log('\n--- Test Suite 3: Booking Workflow & Double Booking Prevention ---');
    const bookResult = await appointmentService.bookAppointment({
      patient_id: 1,
      doctor_id: 1,
      department_id: 1,
      appointment_date: '2026-09-28',
      appointment_time: '10:00:00',
      type: 'consultation',
      reason: 'Bi-annual cardiology evaluation'
    }, mockAdmin);

    assert(bookResult.id > 0, 'New appointment booked successfully');
    assert(bookResult.appointmentNumber.startsWith('APT-'), 'Unique appointment number generated');

    // Attempt Double Booking on the same doctor, date, and slot
    let collisionBlocked = false;
    try {
      await appointmentService.bookAppointment({
        patient_id: 2,
        doctor_id: 1,
        department_id: 1,
        appointment_date: '2026-09-28',
        appointment_time: '10:00:00',
        type: 'general',
        reason: 'Attempted duplicate booking'
      }, mockAdmin);
    } catch (err) {
      collisionBlocked = true;
    }
    assert(collisionBlocked === true, 'Double booking collision was blocked on identical slot');

    // Test Suite 4: Reschedule Appointment
    console.log('\n--- Test Suite 4: Rescheduling Workflow ---');
    const reschedResult = await appointmentService.rescheduleAppointment(
      bookResult.id,
      {
        appointment_date: '2026-09-29',
        appointment_time: '11:20:00',
        reason: 'Patient rescheduled due to work trip'
      },
      mockAdmin
    );
    assert(reschedResult.appointment_date === '2026-09-29', 'Appointment date updated to new date');
    assert(reschedResult.appointment_time === '11:20', 'Appointment time updated to new time');

    // Test Suite 5: Status Transitions Workflow
    console.log('\n--- Test Suite 5: Complete Status Transition Lifecycle ---');
    // 1. Confirm
    const confRes = await appointmentService.updateAppointmentStatus(bookResult.id, { status: 'confirmed' }, mockAdmin);
    assert(confRes.status === 'confirmed', 'Status updated to confirmed');

    // 2. Check-In
    const checkInRes = await appointmentService.updateAppointmentStatus(bookResult.id, { status: 'checked_in' }, mockAdmin);
    assert(checkInRes.status === 'checked_in', 'Status updated to checked_in');

    const apptAfterCheckIn = await appointmentService.getAppointmentById(bookResult.id, mockAdmin);
    assert(apptAfterCheckIn.check_in_time !== null, 'Check-in timestamp recorded in database');

    // 3. In Progress (In Consultation)
    const inProgRes = await appointmentService.updateAppointmentStatus(bookResult.id, { status: 'in_progress' }, mockAdmin);
    assert(inProgRes.status === 'in_progress', 'Status updated to in_progress (In Consultation)');

    // 4. Complete
    const compRes = await appointmentService.updateAppointmentStatus(bookResult.id, { status: 'completed' }, mockAdmin);
    assert(compRes.status === 'completed', 'Status updated to completed');

    // Test Suite 6: Cancellation with Reason
    console.log('\n--- Test Suite 6: Cancellation & Slot Release ---');
    const cancelAppt = await appointmentService.bookAppointment({
      patient_id: 1,
      doctor_id: 1,
      department_id: 1,
      appointment_date: '2026-09-30',
      appointment_time: '12:00:00',
      reason: 'Temporary test appointment'
    }, mockAdmin);

    const cancRes = await appointmentService.updateAppointmentStatus(cancelAppt.id, {
      status: 'cancelled',
      cancellation_reason: 'Patient requested cancellation'
    }, mockAdmin);
    assert(cancRes.status === 'cancelled', 'Appointment successfully cancelled');

    const apptAfterCancel = await appointmentService.getAppointmentById(cancelAppt.id, mockAdmin);
    assert(apptAfterCancel.cancellation_reason === 'Patient requested cancellation', 'Cancellation reason saved');
    assert(apptAfterCancel.cancelled_at !== null, 'Cancellation timestamp recorded');

    // Clean up test appointments
    await appointmentService.deleteAppointment(bookResult.id, mockAdmin);
    await appointmentService.deleteAppointment(cancelAppt.id, mockAdmin);

    console.log('\n======================================================');
    console.log(`🏁 APPOINTMENT MODULE INTEGRATION TEST RESULTS:`);
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

runAppointmentIntegrationTests();
