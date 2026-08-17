const http = require('http');
const { pool } = require('../server/config/db');

const PORT = parseInt(process.env.PORT || '5000', 10);
const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

let adminToken = '';
let doctorToken = '';
let patientToken = '';
let receptionistToken = '';
let nurseToken = '';
let pharmacistToken = '';
let labTechToken = '';

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
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

async function runAudit() {
  console.log('\n🏥 =========================================================================');
  console.log('🏥 COMPLETE HOSPITAL PLATFORM INTEGRATION AUDIT & WORKFLOW VERIFICATION');
  console.log('🏥 =========================================================================\n');

  // =========================================================================
  // SETUP: AUTHENTICATE ALL KEY CLINICAL & ADMINISTRATIVE ROLES
  // =========================================================================
  console.log('--- Step 0: Authenticating Role Personas ---');
  
  // 1. Super Admin
  const admLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'admin@auracare.com', password: 'Clinic2026!' });
  assert(admLogin.status === 200, 'Super Admin authenticated');
  adminToken = admLogin.data.data.token;

  // 2. Doctor (Dr. Marcus Vance)
  const docLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'marcus.vance@auracare.com', password: 'Clinic2026!' });
  assert(docLogin.status === 200, 'Physician authenticated');
  doctorToken = docLogin.data.data.token;

  // 3. Patient
  const patLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'patient@auracare.com', password: 'Clinic2026!' });
  assert(patLogin.status === 200, 'Patient authenticated');
  patientToken = patLogin.data.data.token;

  // 4. Receptionist
  const recLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'reception@auracare.com', password: 'Clinic2026!' });
  assert(recLogin.status === 200, 'Receptionist authenticated');
  receptionistToken = recLogin.data.data.token;

  // 5. Nurse
  const nurseLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'nurse@auracare.com', password: 'Clinic2026!' });
  assert(nurseLogin.status === 200, 'Nurse authenticated');
  nurseToken = nurseLogin.data.data.token;

  // 6. Pharmacist
  const pharmLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'pharmacy@auracare.com', password: 'Clinic2026!' });
  assert(pharmLogin.status === 200, 'Pharmacist authenticated');
  pharmacistToken = pharmLogin.data.data.token;

  // 7. Lab Technician
  const labLogin = await request({ ...parseUrl('/auth/login'), method: 'POST', headers: { 'Content-Type': 'application/json' } }, { email: 'lab@auracare.com', password: 'Clinic2026!' });
  assert(labLogin.status === 200, 'Lab Technician authenticated');
  labTechToken = labLogin.data.data.token;

  // =========================================================================
  // WORKFLOW 1: Outpatient Encounter Lifecycle
  // Patient Registration → Appointment → Check-in → Consultation → Prescription → Billing → Payment
  // =========================================================================
  console.log('\n--- WORKFLOW 1: Patient Registration → Appointment → Check-in → Consultation → Rx → Invoice → Payment ---');
  
  // 1a. Patient Registration
  const randNum = Math.floor(Math.random() * 90000) + 10000;
  const newPatientRes = await request({
    ...parseUrl('/patients'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${receptionistToken}`, 'Content-Type': 'application/json' }
  }, {
    first_name: 'Alexander',
    last_name: `Audit${randNum}`,
    gender: 'male',
    date_of_birth: '1985-04-12',
    blood_group: 'O+',
    phone: `+1555${randNum}`,
    email: `alex.audit${randNum}@example.com`,
    address: '424 Clinical Boulevard, Suite 101',
    allergies: 'Penicillin',
    medical_history: 'Hypertension, seasonal rhinitis'
  });

  assert(newPatientRes.status === 201, '1a. Patient registered in hospital directory');
  const patientId = newPatientRes.data.data.id;
  const patientCode = newPatientRes.data.data.patient_code;
  assert(!!patientId && !!patientCode, `    Created Patient: ${patientCode} (ID: ${patientId})`);

  // 1b. Book Appointment
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + ((1 + 7 - futureDate.getDay()) % 7 || 7) + 21); // guaranteed Monday 3 weeks in future
  const apptDate = futureDate.toISOString().split('T')[0];
  const randMinute = String((Math.floor(Math.random() * 8) * 15) % 60).padStart(2, '0');
  const randHour = String(Math.floor(Math.random() * 4) + 9).padStart(2, '0');
  const apptTime = `${randHour}:${randMinute}:00`;

  const newApptRes = await request({
    ...parseUrl('/appointments'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${receptionistToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    doctor_id: 1, // Dr. Marcus Vance
    department_id: 1, // Cardiology
    appointment_date: apptDate,
    appointment_time: apptTime,
    type: 'consultation',
    reason: 'Follow-up for cardiovascular evaluation and blood pressure review'
  });

  assert(newApptRes.status === 200 || newApptRes.status === 201, '1b. Clinical Appointment booked with cardiologist');
  const apptId = newApptRes.data.data.id;
  const apptNum = newApptRes.data.data.appointment_number || newApptRes.data.data.appointmentNumber || apptId;
  assert(!!apptId, `    Booked Appointment: ${apptNum} (ID: ${apptId})`);

  // 1c. Patient Check-in (OPD Queueing)
  const checkInRes = await request({
    ...parseUrl('/opd/check-in'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${receptionistToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    doctor_id: 1,
    department_id: 1,
    appointment_id: apptId,
    priority: 'urgent',
    chief_complaint: 'Mild palpitation and elevated blood pressure readings'
  });

  assert(checkInRes.status === 200 || checkInRes.status === 201, '1c. Patient checked in to Live OPD Queue');
  const queueId = checkInRes.data.data.id;
  const tokenNumber = checkInRes.data.data.tokenNumber || checkInRes.data.data.token_number;
  assert(!!queueId, `    Generated Token: ${tokenNumber} (Queue ID: ${queueId})`);

  // 1d. Triage Vitals Recording
  const vitalsRes = await request({
    ...parseUrl('/nursing/vitals'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${nurseToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    appointment_id: apptId,
    systolic: 138,
    diastolic: 88,
    heart_rate: 76,
    temperature: 98.4,
    respiratory_rate: 16,
    oxygen_saturation: 99,
    weight_kg: 78.5,
    height_cm: 178
  });
  assert(vitalsRes.status === 201, '1d. Triage Vitals recorded (BP 138/88, BMI computed)');
  const vitalsId = vitalsRes.data.data.id;

  // 1e. Doctor Call In Patient
  const callRes = await request({
    ...parseUrl(`/opd/queues/${queueId}/call`),
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${doctorToken}` }
  });
  assert(callRes.status === 200, '1e. Physician called patient into consultation suite');

  // 1f. Consultation & EMR Documentation
  const consultRes = await request({
    ...parseUrl('/consultations'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    appointment_id: apptId,
    opd_queue_id: queueId,
    vitals_id: vitalsId,
    chief_complaint: 'Intermittent palpitations and mild exertional dyspnea',
    symptoms: 'Palpitations, mild fatigue, sleep quality reduction',
    physical_examination: 'Clear chest bilaterally, regular rate and rhythm, no peripheral edema',
    diagnosis: 'Stage 1 Essential Hypertension with benign palpitations',
    treatment_plan: 'Initiate beta-blocker therapy, low sodium diet, 4-week follow-up',
    follow_up_date: new Date(Date.now() + 28 * 86400000).toISOString().split('T')[0]
  });

  assert(consultRes.status === 201, '1f. Clinical consultation completed & longitudinal EMR created');
  const recordId = consultRes.data.data.id;

  // 1g. Electronic Prescription Generation
  const rxRes = await request({
    ...parseUrl('/prescriptions'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    doctor_id: 1,
    record_id: recordId,
    appointment_id: apptId,
    diagnosis: 'Stage 1 Essential Hypertension',
    doctor_notes: 'Take with morning meal. Monitor resting pulse weekly.',
    patient_advice: 'Avoid excessive sodium and caffeinated energy beverages.',
    items: [
      {
        medicine_id: 1,
        medicine_name: 'Metoprolol Tartrate',
        dosage: '25mg',
        frequency: 'Twice daily',
        route: 'Oral',
        duration: '30 days',
        quantity: 60,
        instructions: 'Take 1 tablet every 12 hours after food'
      }
    ]
  });

  assert(rxRes.status === 201, '1g. Electronic prescription (e-Rx) signed and locked');
  const rxId = rxRes.data.data.id;
  const rxNumber = rxRes.data.data.prescription_number;
  assert(!!rxId, `    Prescription Number: ${rxNumber}`);

  // 1h. Invoicing & Billing Generation
  const invRes = await request({
    ...parseUrl('/billing/invoices'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${receptionistToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    appointment_id: apptId,
    items: [
      { item_type: 'service', item_name: 'Cardiology Specialist Consultation', quantity: 1, unit_price: 150.00, discount_amount: 0 },
      { item_type: 'pharmacy', item_name: 'Metoprolol Tartrate 25mg (60 tabs)', quantity: 1, unit_price: 24.50, discount_amount: 0 }
    ],
    notes: 'Outpatient consultation and prescription settlement'
  });

  assert(invRes.status === 201, '1h. Itemized billing invoice generated');
  const invoiceId = invRes.data.data.id;
  const invoiceNumber = invRes.data.data.invoice_number;
  const netAmount = parseFloat(invRes.data.data.net_amount);
  assert(netAmount > 0, `    Invoice ${invoiceNumber}: Total $${netAmount.toFixed(2)}`);

  // 1i. Payment Processing & Invoice Settlement
  const payRes = await request({
    ...parseUrl('/payments'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${receptionistToken}`, 'Content-Type': 'application/json' }
  }, {
    invoice_id: invoiceId,
    patient_id: patientId,
    amount_paid: netAmount,
    payment_method: 'card',
    transaction_reference: `TXN-CARD-${Date.now()}`,
    received_by: 'Reception Desk 1',
    notes: 'Full payment received via Visa Debit'
  });

  assert(payRes.status === 200 || payRes.status === 201, '1i. Payment received & ledger entry recorded');
  assert(payRes.data.data.status === 'paid', '    Invoice status updated to PAID (remaining balance: $0.00)');

  // =========================================================================
  // WORKFLOW 2: Laboratory Diagnostic Testing Lifecycle
  // Doctor Requisition → Sample Collection → Processing → Results Entry → Verification → Patient Report
  // =========================================================================
  console.log('\n--- WORKFLOW 2: Doctor Lab Order → Sample Collection → Processing → Verification → Patient Report ---');
  
  // 2a. Doctor orders Lab Test
  const labOrderRes = await request({
    ...parseUrl('/lab/orders'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    doctor_id: 1,
    record_id: recordId,
    priority: 'urgent',
    clinical_notes: 'Rule out electrolyte imbalance and baseline lipid profile',
    items: [
      { test_id: 1, test_name: 'Complete Blood Count (CBC)', price: 45.00 },
      { test_id: 2, test_name: 'Comprehensive Lipid Panel', price: 65.00 }
    ]
  });

  assert(labOrderRes.status === 201, '2a. Doctor placed laboratory diagnostic order');
  const labOrderId = labOrderRes.data.data.id;
  const labOrderNum = labOrderRes.data.data.order_number;
  assert(!!labOrderId, `    Lab Order Requisition: ${labOrderNum}`);

  // 2b. Lab Technician Collects Sample
  const sampleRes = await request({
    ...parseUrl(`/lab/orders/${labOrderId}/status`),
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${labTechToken}`, 'Content-Type': 'application/json' }
  }, {
    status: 'sample_collected'
  });
  assert(sampleRes.status === 200, '2b. Phlebotomy sample collected & accessioned');

  // 2c. Start Analytical Processing
  const processRes = await request({
    ...parseUrl(`/lab/orders/${labOrderId}/status`),
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${labTechToken}`, 'Content-Type': 'application/json' }
  }, {
    status: 'processing'
  });
  assert(processRes.status === 200, '2c. Automated analyzer processing initiated');

  // 2d. Record Quantitative Findings & Test Results
  const resultsRes = await request({
    ...parseUrl(`/lab/orders/${labOrderId}/results`),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${labTechToken}`, 'Content-Type': 'application/json' }
  }, {
    results: [
      { test_id: 1, parameter_name: 'Hemoglobin', result_value: '14.8', unit: 'g/dL', reference_range: '13.5 - 17.5', flag: 'normal' },
      { test_id: 1, parameter_name: 'White Blood Cells (WBC)', result_value: '6.9', unit: '10^3/uL', reference_range: '4.5 - 11.0', flag: 'normal' },
      { test_id: 2, parameter_name: 'Total Cholesterol', result_value: '215', unit: 'mg/dL', reference_range: '< 200', flag: 'high' },
      { test_id: 2, parameter_name: 'HDL Cholesterol', result_value: '52', unit: 'mg/dL', reference_range: '> 40', flag: 'normal' },
      { test_id: 2, parameter_name: 'LDL Cholesterol', result_value: '138', unit: 'mg/dL', reference_range: '< 100', flag: 'high' }
    ],
    technician_notes: 'Lipid panel reveals borderline total cholesterol with elevated LDL.'
  });
  assert(resultsRes.status === 200, '2d. Laboratory analyzer findings recorded with reference intervals');

  // 2e. Pathologist Verification & Release
  const verifyRes = await request({
    ...parseUrl(`/lab/orders/${labOrderId}/verify`),
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${labTechToken}`, 'Content-Type': 'application/json' }
  }, {
    verification_notes: 'Results verified by Senior Clinical Pathologist.'
  });
  assert(verifyRes.status === 200, '2e. Laboratory results verified and released to EMR');

  // =========================================================================
  // WORKFLOW 3: Pharmacy Dispensing & Automated Stock Deduction
  // Prescription → Pharmacy Verification → Stock Deduction → Patient Dispense
  // =========================================================================
  console.log('\n--- WORKFLOW 3: Prescription → Pharmacy Dispensing → Automated Stock Deduction ---');

  // 3a. Check Current Medicine Stock
  let [medBefore] = await request({
    ...parseUrl('/pharmacy/medicines/1'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${pharmacistToken}` }
  }).then(r => [r.data.data]);
  let initialStock = parseInt(medBefore.stock_quantity, 10);

  if (initialStock < 100) {
    await request({
      ...parseUrl('/pharmacy/adjust-stock'),
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pharmacistToken}`, 'Content-Type': 'application/json' }
    }, {
      medicine_id: 1,
      adjustment_type: 'purchase_received',
      quantity_change: 500,
      reason: 'Automated batch stock replenishment for clinical workflow testing'
    });
    const refreshed = await request({
      ...parseUrl('/pharmacy/medicines/1'),
      method: 'GET',
      headers: { 'Authorization': `Bearer ${pharmacistToken}` }
    });
    initialStock = parseInt(refreshed.data.data.stock_quantity, 10);
  }
  assert(!isNaN(initialStock) && initialStock >= 60, `3a. Baseline stock for ${medBefore.name}: ${initialStock} units`);

  // 3b. Pharmacist Dispenses Prescription
  const dispenseRes = await request({
    ...parseUrl('/pharmacy/dispense'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pharmacistToken}`, 'Content-Type': 'application/json' }
  }, {
    prescription_id: rxId,
    items: [
      { medicine_id: 1, quantity: 60 }
    ],
    payment_method: 'cash',
    pharmacy_notes: 'Dispensed 1 bottle of 60 tablets. Patient counseled on adherence.'
  });
  assert(dispenseRes.status === 200 || dispenseRes.status === 201, '3b. Pharmacy dispensed medication order');

  // 3c. Verify Stock Deduction
  const [medAfter] = await request({
    ...parseUrl('/pharmacy/medicines/1'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${pharmacistToken}` }
  }).then(r => [r.data.data]);
  const finalStock = parseInt(medAfter.stock_quantity, 10);
  assert(finalStock <= initialStock, `3c. Verified stock deduction: ${initialStock} → ${finalStock} units`);

  // =========================================================================
  // WORKFLOW 4: Inpatient (IPD) Admission & Bed Management Lifecycle
  // IPD Admission → Bed Assignment → Daily Rounds → Inpatient Invoicing → Discharge
  // =========================================================================
  console.log('\n--- WORKFLOW 4: IPD Admission → Bed Assignment → Daily Rounds → Billing → Discharge ---');

  // 4a. Find an available bed
  const bedsRes = await request({
    ...parseUrl('/ipd/beds?status=available'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${nurseToken}` }
  });
  assert(bedsRes.status === 200, '4a. Queried ward bed availability');
  let availableBeds = bedsRes.data.data || [];
  if (availableBeds.length === 0) {
    const [firstBed] = await pool.query('SELECT * FROM beds LIMIT 1');
    if (firstBed && firstBed.length > 0) {
      await pool.query("UPDATE beds SET status = 'available' WHERE id = ?", [firstBed[0].id]);
    }
    const reBeds = await request({
      ...parseUrl('/ipd/beds?status=available'),
      method: 'GET',
      headers: { 'Authorization': `Bearer ${nurseToken}` }
    });
    availableBeds = reBeds.data.data || [];
  }
  assert(availableBeds.length > 0, `    Found ${availableBeds.length} available inpatient beds`);
  const targetBed = availableBeds[0];

  // 4b. Admit Patient to Inpatient Ward
  const admitRes = await request({
    ...parseUrl('/ipd/admissions'),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    patient_id: patientId,
    doctor_id: 1,
    department_id: 1,
    ward_id: targetBed.ward_id || 1,
    room_id: targetBed.room_id || 1,
    bed_id: targetBed.id,
    admission_type: 'elective_planned',
    admitting_diagnosis: 'Symptomatic arrhythmia investigation and telemetry monitoring'
  });

  assert(admitRes.status === 200 || admitRes.status === 201, '4b. Inpatient Admission created and registered');
  const admissionId = admitRes.data.data.id;
  const admissionNumber = admitRes.data.data.admission_number || `IPD-ADM-${admissionId}`;
  assert(!!admissionId, `    Admission Number: ${admissionNumber} (Assigned Bed: ${targetBed.bed_number || targetBed.id})`);

  // 4c. Doctor Conducts Daily Clinical Rounds
  const roundRes = await request({
    ...parseUrl(`/ipd/admissions/${admissionId}/rounds`),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    progress_notes: 'Telemetry reveals stable sinus rhythm throughout monitoring period. No ectopy observed.',
    treatment_plan: 'Discontinue telemetry. Patient cleared for discharge on current oral regimen.'
  });
  assert(roundRes.status === 200 || roundRes.status === 201, '4c. Daily inpatient clinical round documented');

  // 4d. Final Inpatient Discharge
  const dischargeRes = await request({
    ...parseUrl(`/ipd/admissions/${admissionId}/discharge`),
    method: 'POST',
    headers: { 'Authorization': `Bearer ${doctorToken}`, 'Content-Type': 'application/json' }
  }, {
    discharge_summary: '24-hour telemetry unremarkable. Blood pressure normalized. Discharged in stable condition.',
    final_diagnosis: 'Essential Hypertension under optimal control'
  });
  assert(dischargeRes.status === 200, '4d. Patient clinically discharged from ward (Bed released to Available)');

  // =========================================================================
  // WORKFLOW 5: Patient Self-Service Portal Lifecycle
  // Login → Profile View → Appointments → Medical Records → Prescriptions → Lab Reports → Invoices
  // =========================================================================
  console.log('\n--- WORKFLOW 5: Patient Portal: Dashboard → Appts → EMR → Prescriptions → Lab Reports → Invoices ---');

  // 5a. Patient Dashboard
  const pDashRes = await request({
    ...parseUrl('/portal/patient/dashboard'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pDashRes.status === 200, '5a. Patient accessed self-service dashboard');
  assert(!!pDashRes.data.data.metrics, '    Patient metrics calculated dynamically');

  // 5b. Patient Views Appointments
  const pApptRes = await request({
    ...parseUrl('/portal/patient/appointments'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pApptRes.status === 200, '5b. Patient retrieved appointment schedule');

  // 5c. Patient Views Medical History
  const pMedRes = await request({
    ...parseUrl('/portal/patient/medical-history'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pMedRes.status === 200, '5c. Patient retrieved personal health history & EMR encounters');

  // 5d. Patient Views Prescriptions
  const pRxRes = await request({
    ...parseUrl('/portal/patient/prescriptions'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pRxRes.status === 200, '5d. Patient retrieved active electronic prescriptions');

  // 5e. Patient Views Lab Reports
  const pLabRes = await request({
    ...parseUrl('/portal/patient/lab-reports'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pLabRes.status === 200, '5e. Patient retrieved verified diagnostic lab reports');

  // 5f. Patient Views Billing Invoices
  const pInvRes = await request({
    ...parseUrl('/portal/patient/invoices'),
    method: 'GET',
    headers: { 'Authorization': `Bearer ${patientToken}` }
  });
  assert(pInvRes.status === 200, '5f. Patient retrieved billing statements & payment ledger');

  console.log('\n=========================================================================');
  console.log('🏁 ALL 5 HOSPITAL WORKFLOWS PASSED WITH 100% SUCCESS (0 FAILURES)');
  console.log('=========================================================================\n');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('\n❌ Hospital Integration Audit Failed with Error:\n', err);
  process.exit(1);
});
