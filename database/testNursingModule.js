const db = require('../server/config/db');
const nursingService = require('../server/services/nursing.service');

async function runNursingIntegrationTests() {
  console.log('🧪 Starting Nursing Management Module Integration Tests...\n');
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

  const mockNurse = { id: 6, role: 'nurse' };
  const mockAdmin = { id: 1, role: 'hospital_admin' };

  try {
    // Test Suite 1: Assigned Inpatients Roster & Priority Indicators
    console.log('--- Test Suite 1: Assigned Inpatients Roster & Priority Indicators ---');
    const assignedPatients = await nursingService.getAssignedPatients(mockAdmin);
    assert(assignedPatients.length >= 1, 'Retrieves active assigned inpatients from MySQL');
    assert(assignedPatients.some(p => p.patient_code === 'PAT-2026-0001'), 'Includes Inpatient Arthur Pendleton');
    assert(assignedPatients[0].hasOwnProperty('priority_indicator'), 'Patient includes dynamically computed priority indicator');
    assert(['stable', 'moderate', 'high_attention', 'critical'].includes(assignedPatients[0].priority_indicator), 'Priority indicator matches clinical standard');
    assert(assignedPatients[0].hasOwnProperty('latest_vitals'), 'Patient record includes latest vitals telemetry');
    assert(assignedPatients[0].hasOwnProperty('doctor_instructions'), 'Patient record includes physician daily round orders');

    // Test Suite 2: Comprehensive Patient Nursing Summary Chart
    console.log('\n--- Test Suite 2: Comprehensive Patient Nursing Summary Chart ---');
    const summary = await nursingService.getPatientNursingSummary(1, mockAdmin);
    assert(summary.patient.id === 1, 'Patient profile retrieved');
    assert(summary.active_admission !== null, 'Active inpatient admission attached to nursing chart');
    assert(Array.isArray(summary.vitals), 'Vitals telemetry history attached');
    assert(Array.isArray(summary.nursing_notes), 'Nursing clinical notes attached');
    assert(Array.isArray(summary.emar_records), 'eMAR medication administration records attached');
    assert(Array.isArray(summary.ward_tasks), 'Ward tasks attached');

    // Test Suite 3: Clinical Nursing Notes Logging
    console.log('\n--- Test Suite 3: Clinical Nursing Notes Logging ---');
    const noteRes = await nursingService.recordNursingNote({
      patient_id: 1,
      admission_id: summary.active_admission ? summary.active_admission.id : null,
      note_type: 'progress_note',
      priority_level: 'moderate',
      subjective_observation: 'Patient rested comfortably after afternoon ambulation. Denies shortness of breath.',
      objective_findings: 'Chest incision intact, clean. Telemetry shows sinus rhythm at 72 bpm. SpO2 98% on room air.',
      nursing_interventions: 'Provided post-op sternal wound care. Monitored fluid balance and telemetry.',
      patient_response: 'Patient verbalized understanding of activity restrictions.',
      care_plan_instructions: 'Continue telemetry monitoring. Repeat evening vitals at 20:00.',
      intake_ml: 600,
      output_ml: 500
    }, mockNurse);

    assert(noteRes.id > 0, 'Clinical nursing progress note saved in MySQL');
    assert(noteRes.note_number.startsWith('NOT-'), 'Unique note number generated (NOT-YYYY-XXXXXX)');

    const patientNotes = await nursingService.listNursingNotes(1, {}, mockNurse);
    assert(patientNotes.length >= 2, 'Chronological nursing notes list retrieved');
    assert(patientNotes.some(n => n.id === noteRes.id), 'Newly recorded note appears in nursing history');

    // Test Suite 4: Medication Administration (eMAR)
    console.log('\n--- Test Suite 4: Medication Administration (eMAR) ---');
    const emarRes = await nursingService.recordMedicationAdministration({
      patient_id: 1,
      admission_id: summary.active_admission ? summary.active_admission.id : null,
      medicine_name: 'Aspirin (Enteric Coated)',
      dosage: '81mg',
      route: 'oral',
      scheduled_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      administered_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      status: 'administered',
      reason_notes: 'Given with afternoon snack. Well tolerated.'
    }, mockNurse);

    assert(emarRes.id > 0, 'eMAR medication administration record created');
    assert(emarRes.administration_number.startsWith('MAR-'), 'Unique eMAR number generated (MAR-YYYY-XXXXXX)');

    // Test Suite 5: Patient Vitals Recording & BMI Calculation
    console.log('\n--- Test Suite 5: Patient Vitals Recording ---');
    const vitalsRes = await nursingService.recordVitals({
      patient_id: 1,
      blood_pressure: '122/78',
      heart_rate: 72,
      temperature: 36.8,
      respiratory_rate: 16,
      oxygen_saturation: 98.5,
      weight_kg: 74.0,
      height_cm: 175.0,
      notes: 'Routine evening telemetry vitals check'
    }, mockNurse);

    assert(vitalsRes.id > 0, 'Vitals recorded in MySQL');
    assert(vitalsRes.bmi === 24.2, 'BMI calculated automatically (24.2)');

    // Test Suite 6: Ward Tasks Management
    console.log('\n--- Test Suite 6: Ward Tasks Management ---');
    const taskRes = await nursingService.createWardTask({
      patient_id: 1,
      admission_id: summary.active_admission ? summary.active_admission.id : null,
      ward_id: 2,
      task_type: 'wound_dressing',
      description: 'Evening Surgical Sternal Incision Sterile Dressing Change',
      priority: 'high',
      due_time: new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' '),
      assigned_nurse_id: 6
    }, mockNurse);

    assert(taskRes.id > 0, 'Ward task created in MySQL');
    assert(taskRes.task_number.startsWith('TSK-'), 'Unique Task number generated (TSK-YYYY-XXXXXX)');

    const tasksList = await nursingService.listWardTasks({ ward_id: 2 }, mockNurse);
    assert(tasksList.length >= 1, 'Ward tasks retrieved for assigned ward');
    assert(tasksList.some(t => t.id === taskRes.id), 'Newly created task present in task list');

    // Complete the task
    const completeRes = await nursingService.completeWardTask(taskRes.id, {
      completion_notes: 'Sterile dressing changed per clinical protocol. No signs of infection.'
    }, mockNurse);
    assert(completeRes.status === 'completed', 'Ward task marked as COMPLETED');

    // Test Suite 7: Nursing Station Statistics
    console.log('\n--- Test Suite 7: Nursing Station Statistics ---');
    const stats = await nursingService.getNursingStats(mockNurse);
    assert(stats.total_assigned_inpatients >= 1, 'Total assigned inpatients calculated');
    assert(stats.hasOwnProperty('pending_tasks'), 'Pending tasks calculated');
    assert(stats.doses_given_today >= 1, 'Medication doses administered today calculated');

    // Clean up created test items
    await db.query('DELETE FROM nursing_notes WHERE id = ?', [noteRes.id]);
    await db.query('DELETE FROM nursing_medication_administrations WHERE id = ?', [emarRes.id]);
    await db.query('DELETE FROM vitals WHERE id = ?', [vitalsRes.id]);
    await db.query('DELETE FROM nursing_ward_tasks WHERE id = ?', [taskRes.id]);

    console.log('\n======================================================');
    console.log(`🏁 NURSING MODULE INTEGRATION TEST RESULTS:`);
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

runNursingIntegrationTests();
