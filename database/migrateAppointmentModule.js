const db = require('../server/config/db');

async function migrateAppointmentModule() {
  console.log('🚀 Starting Appointment Management Module Database Migration...');

  // 1. Update status enum in appointments table
  await db.query(`
    ALTER TABLE appointments 
    MODIFY COLUMN status ENUM('pending','confirmed','checked_in','in_progress','completed','cancelled','no_show') DEFAULT 'pending'
  `);
  console.log('✅ Updated appointments status ENUM to include checked_in and in_progress.');

  // 2. Add timestamp tracking and cancellation columns
  const [columns] = await db.query('DESCRIBE appointments');
  const colNames = columns.map(c => c.Field);

  if (!colNames.includes('check_in_time')) {
    await db.query('ALTER TABLE appointments ADD COLUMN check_in_time DATETIME NULL AFTER notes');
  }
  if (!colNames.includes('consultation_start_time')) {
    await db.query('ALTER TABLE appointments ADD COLUMN consultation_start_time DATETIME NULL AFTER check_in_time');
  }
  if (!colNames.includes('consultation_end_time')) {
    await db.query('ALTER TABLE appointments ADD COLUMN consultation_end_time DATETIME NULL AFTER consultation_start_time');
  }
  if (!colNames.includes('cancellation_reason')) {
    await db.query('ALTER TABLE appointments ADD COLUMN cancellation_reason VARCHAR(255) NULL AFTER consultation_end_time');
  }
  if (!colNames.includes('cancelled_by')) {
    await db.query('ALTER TABLE appointments ADD COLUMN cancelled_by INT NULL AFTER cancellation_reason');
  }
  if (!colNames.includes('cancelled_at')) {
    await db.query('ALTER TABLE appointments ADD COLUMN cancelled_at DATETIME NULL AFTER cancelled_by');
  }
  if (!colNames.includes('rescheduled_from_id')) {
    await db.query('ALTER TABLE appointments ADD COLUMN rescheduled_from_id INT NULL AFTER cancelled_at');
  }
  if (!colNames.includes('rescheduled_at')) {
    await db.query('ALTER TABLE appointments ADD COLUMN rescheduled_at DATETIME NULL AFTER rescheduled_from_id');
  }
  console.log('✅ Verified timestamp and cancellation columns in appointments table.');

  // 3. Seed diverse appointments across statuses if fewer than 10
  const [countRows] = await db.query('SELECT COUNT(*) as cnt FROM appointments');
  if (countRows[0].cnt < 12) {
    console.log('Seeding diverse appointments across doctors, patients, and statuses...');
    const today = new Date();
    const fmt = d => d.toISOString().split('T')[0];

    const todayStr = fmt(today);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = fmt(tomorrow);
    const in2Days = new Date(today);
    in2Days.setDate(today.getDate() + 2);
    const in2DaysStr = fmt(in2Days);

    const sampleAppointments = [
      {
        num: 'APT-2026-1010',
        pat: 1, doc: 1, dept: 1,
        date: todayStr, time: '09:00:00',
        type: 'consultation', status: 'checked_in',
        reason: 'Post-CABG follow-up and ECG evaluation',
        checkIn: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
      {
        num: 'APT-2026-1011',
        pat: 2, doc: 1, dept: 1,
        date: todayStr, time: '09:20:00',
        type: 'consultation', status: 'in_progress',
        reason: 'Hypertension review & echocardiogram follow-up',
        checkIn: new Date().toISOString().slice(0, 19).replace('T', ' '),
        startCon: new Date().toISOString().slice(0, 19).replace('T', ' ')
      },
      {
        num: 'APT-2026-1012',
        pat: 3, doc: 2, dept: 2,
        date: todayStr, time: '10:00:00',
        type: 'consultation', status: 'confirmed',
        reason: 'Chronic migraine with aura assessment'
      },
      {
        num: 'APT-2026-1013',
        pat: 4, doc: 3, dept: 3,
        date: todayStr, time: '10:30:00',
        type: 'general', status: 'pending',
        reason: 'Pediatric annual wellness and immunization schedule'
      },
      {
        num: 'APT-2026-1014',
        pat: 5, doc: 4, dept: 4,
        date: tomorrowStr, time: '11:00:00',
        type: 'consultation', status: 'confirmed',
        reason: 'Right knee osteoarthritis and joint injection consult'
      },
      {
        num: 'APT-2026-1015',
        pat: 6, doc: 5, dept: 5,
        date: tomorrowStr, time: '14:00:00',
        type: 'general', status: 'pending',
        reason: 'Adult annual preventive physical exam & lab panel'
      },
      {
        num: 'APT-2026-1016',
        pat: 7, doc: 6, dept: 6,
        date: in2DaysStr, time: '09:30:00',
        type: 'consultation', status: 'confirmed',
        reason: 'Severe plaque psoriasis biological therapy review'
      },
      {
        num: 'APT-2026-1017',
        pat: 8, doc: 1, dept: 1,
        date: '2026-08-08', time: '11:30:00',
        type: 'consultation', status: 'cancelled',
        reason: 'Routine cardiac screening',
        cancReason: 'Patient travel conflict',
        cancAt: '2026-08-07 14:00:00'
      },
      {
        num: 'APT-2026-1018',
        pat: 9, doc: 2, dept: 2,
        date: '2026-08-09', time: '14:30:00',
        type: 'consultation', status: 'no_show',
        reason: 'Nerve conduction velocity study follow-up'
      }
    ];

    for (const a of sampleAppointments) {
      await db.query(`
        INSERT INTO appointments 
        (appointment_number, patient_id, doctor_id, department_id, appointment_date, appointment_time, type, status, reason, check_in_time, consultation_start_time, cancellation_reason, cancelled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = VALUES(status)
      `, [
        a.num, a.pat, a.doc, a.dept, a.date, a.time, a.type, a.status, a.reason,
        a.checkIn || null, a.startCon || null, a.cancReason || null, a.cancAt || null
      ]);
    }
    console.log('✅ Seeded diverse sample appointments.');
  }

  console.log('🎉 Appointment Management Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateAppointmentModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateAppointmentModule;
