const db = require('../server/config/db');

async function migrateOpdModule() {
  console.log('🚀 Starting OPD Management Module Database Migration...');

  // 1. Create opd_queues table
  await db.query(`
    CREATE TABLE IF NOT EXISTS opd_queues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      token_number VARCHAR(30) NOT NULL,
      token_sequence INT NOT NULL,
      queue_date DATE NOT NULL,
      patient_id INT NOT NULL,
      doctor_id INT NOT NULL,
      department_id INT NOT NULL,
      appointment_id INT NULL,
      patient_type ENUM('appointment', 'walk_in', 'emergency') DEFAULT 'walk_in',
      priority ENUM('normal', 'urgent', 'emergency') DEFAULT 'normal',
      status ENUM('waiting', 'in_consultation', 'completed', 'no_show', 'cancelled') DEFAULT 'waiting',
      vitals_id INT NULL,
      chief_complaint VARCHAR(255) NULL,
      triage_notes TEXT NULL,
      check_in_time DATETIME NOT NULL,
      called_time DATETIME NULL,
      consultation_start_time DATETIME NULL,
      consultation_end_time DATETIME NULL,
      completed_time DATETIME NULL,
      invoice_id INT NULL,
      medical_record_id INT NULL,
      assigned_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (vitals_id) REFERENCES vitals(id) ON DELETE SET NULL,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
      FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE KEY uk_dept_date_seq (department_id, queue_date, token_sequence),
      INDEX idx_queue_lookup (queue_date, status, doctor_id, department_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Verified opd_queues table in MySQL.');

  // 2. Seed realistic OPD queue for today
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const [existingQueue] = await db.query('SELECT id FROM opd_queues WHERE queue_date = ? LIMIT 1', [todayStr]);
  if (existingQueue.length === 0) {
    console.log('Seeding today OPD queue tokens across departments...');

    const sampleTokens = [
      {
        tkn: 'CARD-001', seq: 1, pat: 1, doc: 1, dept: 1,
        type: 'appointment', prio: 'normal', status: 'completed',
        comp: 'Follow-up for post-CABG cardiovascular checkup',
        checkIn: `${todayStr} 08:30:00`,
        called: `${todayStr} 08:45:00`,
        startCon: `${todayStr} 08:45:00`,
        endCon: `${todayStr} 09:10:00`,
        complTime: `${todayStr} 09:10:00`
      },
      {
        tkn: 'CARD-002', seq: 2, pat: 2, doc: 1, dept: 1,
        type: 'walk_in', prio: 'urgent', status: 'in_consultation',
        comp: 'Acute exertional chest tightness & palpitations',
        checkIn: `${todayStr} 09:00:00`,
        called: `${todayStr} 09:15:00`,
        startCon: `${todayStr} 09:15:00`
      },
      {
        tkn: 'CARD-003', seq: 3, pat: 3, doc: 1, dept: 1,
        type: 'appointment', prio: 'normal', status: 'waiting',
        comp: 'Hypertension medication adjustment and blood pressure review',
        checkIn: `${todayStr} 09:15:00`
      },
      {
        tkn: 'NEUR-001', seq: 1, pat: 4, doc: 2, dept: 2,
        type: 'appointment', prio: 'normal', status: 'in_consultation',
        comp: 'Refractory hemi-cranial migraine follow-up',
        checkIn: `${todayStr} 09:05:00`,
        called: `${todayStr} 09:20:00`,
        startCon: `${todayStr} 09:20:00`
      },
      {
        tkn: 'NEUR-002', seq: 2, pat: 5, doc: 2, dept: 2,
        type: 'walk_in', prio: 'normal', status: 'waiting',
        comp: 'Unexplained peripheral paresthesia in lower limbs',
        checkIn: `${todayStr} 09:25:00`
      },
      {
        tkn: 'PED-001', seq: 1, pat: 6, doc: 3, dept: 3,
        type: 'walk_in', prio: 'normal', status: 'waiting',
        comp: 'Pediatric viral fever with cough and rash',
        checkIn: `${todayStr} 09:30:00`
      },
      {
        tkn: 'ORTH-001', seq: 1, pat: 7, doc: 4, dept: 4,
        type: 'appointment', prio: 'normal', status: 'no_show',
        comp: 'Right knee osteoarthritis assessment',
        checkIn: `${todayStr} 08:00:00`
      }
    ];

    for (const q of sampleTokens) {
      await db.query(`
        INSERT INTO opd_queues 
        (token_number, token_sequence, queue_date, patient_id, doctor_id, department_id, patient_type, priority, status, chief_complaint, check_in_time, called_time, consultation_start_time, consultation_end_time, completed_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        q.tkn, q.seq, todayStr, q.pat, q.doc, q.dept,
        q.type, q.prio, q.status, q.comp,
        q.checkIn, q.called || null, q.startCon || null, q.endCon || null, q.complTime || null
      ]);
    }
    console.log('✅ Seeded 7 OPD queue entries for today.');
  }

  console.log('🎉 OPD Management Module Database Migration Completed Successfully!');
}

if (require.main === module) {
  migrateOpdModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateOpdModule;
