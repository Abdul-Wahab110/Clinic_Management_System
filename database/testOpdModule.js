const db = require('../server/config/db');
const opdService = require('../server/services/opd.service');

async function runOpdIntegrationTests() {
  console.log('🧪 Starting OPD Management Module Integration Tests...\n');
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

  const mockStaff = { id: 1, role: 'hospital_admin' };
  const mockDoctor = { id: 2, role: 'doctor' };

  try {
    // Ensure seeded OPD queue rows reflect current date for testing
    await db.query("UPDATE IGNORE opd_queues SET queue_date = CURDATE() WHERE id <= 5");

    // Test Suite 1: Live OPD Dashboard & Queues
    console.log('--- Test Suite 1: Live OPD Queue Dashboard & Statuses ---');
    const dashboard = await opdService.getOpdDashboard({}, mockStaff);
    assert(dashboard.stats.total >= 3, 'Dashboard returns total queued patients count');
    assert(typeof dashboard.stats.waiting === 'number', 'Stats includes waiting patients count');
    assert(typeof dashboard.stats.in_consultation === 'number', 'Stats includes in_consultation count');
    assert(typeof dashboard.stats.completed === 'number', 'Stats includes completed count');
    assert(dashboard.waiting.length > 0, 'Waiting list contains queued patients');
    assert(dashboard.waiting[0].token_number !== undefined, 'Queued patient includes token number');

    // Test Suite 2: Walk-In Patient Registration & Safe Token Generation
    console.log('\n--- Test Suite 2: Walk-In Registration & Safe Token Generation ---');
    const walkInResult = await opdService.registerWalkInPatient({
      first_name: 'Gabriel',
      last_name: 'Stone',
      phone: '+1 (555) 789-3321',
      gender: 'male',
      department_id: 1, // Cardiology
      doctor_id: 1,
      priority: 'urgent',
      chief_complaint: 'Severe atypical chest pain',
      vitals: {
        systolic: 145,
        diastolic: 92,
        heart_rate: 98,
        temperature: 98.6,
        weight_kg: 82,
        height_cm: 178
      }
    }, mockStaff);

    assert(walkInResult.id > 0, 'Walk-in patient registered and entered into queue');
    assert(walkInResult.tokenNumber.startsWith('CARD-'), 'Token number generated with department prefix (CARD-XXX)');
    assert(walkInResult.tokenSequence >= 1, 'Token sequence assigned sequentially');
    assert(walkInResult.status === 'waiting', 'Initial queue status is waiting');

    // Test Suite 3: Appointment Check-In & Token Issuance
    console.log('\n--- Test Suite 3: Appointment Check-In & Queue Induction ---');
    const testApptNum = `TEST-OPD-APT-${Date.now()}`;
    const [apptRes] = await db.query(`
      INSERT INTO appointments 
      (appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason)
      VALUES (?, 1, 2, 2, CURDATE(), '10:00:00', 'consultation', 'confirmed', 'Neurology check-in test')
    `, [testApptNum]);
    const testApptId = apptRes.insertId;

    const checkInResult = await opdService.checkInAppointment(testApptId, mockStaff);
    assert(checkInResult.id > 0, 'Appointment checked in and queued');
    assert(checkInResult.tokenNumber.startsWith('NEUR-'), 'Token generated with department code (NEUR-XXX)');

    const [updatedAppt] = await db.query('SELECT status, check_in_time FROM appointments WHERE id = ?', [testApptId]);
    assert(updatedAppt[0].status === 'checked_in', 'Appointment status transitioned to checked_in');
    assert(updatedAppt[0].check_in_time !== null, 'Appointment recorded check_in_time');

    // Test Suite 4: Triage Vitals Capture & Automatic BMI Calculation
    console.log('\n--- Test Suite 4: Triage Vitals Recording & BMI Calculation ---');
    const vitalsRes = await opdService.recordTriageVitals(
      checkInResult.id,
      {
        systolic: 120,
        diastolic: 80,
        heart_rate: 72,
        temperature: 98.4,
        oxygen_saturation: 99,
        weight_kg: 70,
        height_cm: 175
      },
      mockStaff
    );
    assert(vitalsRes.vitals_id > 0, 'Triage vitals record created in MySQL');
    assert(vitalsRes.bmi === 22.9, 'BMI calculated automatically (70 / 1.75^2 = 22.9)');

    // Test Suite 5: Call Patient into Consultation
    console.log('\n--- Test Suite 5: Consultation Call-In Workflow ---');
    const callRes = await opdService.callPatient(walkInResult.id, mockDoctor);
    assert(callRes.status === 'in_consultation', 'Status updated to in_consultation');

    const [calledRow] = await db.query('SELECT called_time, consultation_start_time FROM opd_queues WHERE id = ?', [walkInResult.id]);
    assert(calledRow[0].called_time !== null, 'Call-in timestamp recorded');
    assert(calledRow[0].consultation_start_time !== null, 'Consultation start timestamp recorded');

    // Test Suite 6: Complete Consultation, EMR Generation & Invoicing Pipeline
    console.log('\n--- Test Suite 6: Consultation Conclusion & Billing Pipeline ---');
    const completeRes = await opdService.completeConsultation(
      walkInResult.id,
      {
        diagnosis: 'Atypical non-cardiac chest discomfort with mild musculoskeletal strain',
        clinical_notes: 'Reassured patient. Normal resting ECG and stable troponin. Advised NSAID trial and follow-up if symptoms persist.',
        follow_up_date: '2026-09-01'
      },
      mockDoctor
    );

    assert(completeRes.status === 'completed', 'Queue status transitioned to completed');
    assert(completeRes.medical_record_id > 0, 'Electronic Medical Record (EMR) created');
    assert(completeRes.invoice_id > 0, 'Billing invoice created automatically');
    assert(completeRes.invoice_number.startsWith('INV-'), 'Invoice reference number generated');
    assert(completeRes.net_amount > 0, 'Consultation fee billed');

    // Test Suite 7: Doctor Reassignment & No-Show Handling
    console.log('\n--- Test Suite 7: Reassignment & No-Show Handling ---');
    // Reassign checkInResult to Doctor 1
    const reassignRes = await opdService.reassignDoctor(checkInResult.id, 1, mockStaff);
    assert(reassignRes.new_doctor_id === 1, 'Doctor successfully reassigned to Doctor 1');

    // Mark No-Show
    const noShowRes = await opdService.markOpdNoShow(checkInResult.id, mockStaff);
    assert(noShowRes.status === 'no_show', 'Patient marked as no-show');

    // Clean up test records
    await db.query('DELETE FROM opd_queues WHERE id IN (?, ?)', [walkInResult.id, checkInResult.id]);
    await db.query('DELETE FROM appointments WHERE id = ?', [testApptId]);

    console.log('\n======================================================');
    console.log(`🏁 OPD MODULE INTEGRATION TEST RESULTS:`);
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

runOpdIntegrationTests();
