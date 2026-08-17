const fs = require('fs');
const path = require('path');
const db = require('../server/config/db');

async function migrateDocumentModule() {
  console.log('📁 Starting Secure Patient Document Management Module Migration...');

  // 1. Ensure private storage directory exists outside /public
  const storageDir = path.join(__dirname, '../storage/documents');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
    console.log(`✅ Created secure private storage directory: ${storageDir}`);
  }

  // 2. Create sample dummy PDF files in storage for testing download/streaming
  const sampleFiles = [
    { name: 'doc_pat1_ecg.pdf', content: '%PDF-1.4 Mock ECG Diagnostic Report for Patient 1' },
    { name: 'doc_pat1_calcium.pdf', content: '%PDF-1.4 Mock Calcium Score CT Scan for Patient 1' },
    { name: 'doc_pat1_insurance.pdf', content: '%PDF-1.4 Mock Insurance Pre-Authorization for Patient 1' },
    { name: 'doc_pat2_brain_mri.pdf', content: '%PDF-1.4 Mock Brain MRI 3T Report for Patient 2' },
    { name: 'doc_pat2_prescription.pdf', content: '%PDF-1.4 Mock Prescription Discharge Order for Patient 2' }
  ];

  for (const f of sampleFiles) {
    const filePath = path.join(storageDir, f.name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, f.content);
    }
  }

  // 3. Create or upgrade patient_documents table
  await db.query(`
    CREATE TABLE IF NOT EXISTS patient_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      document_name VARCHAR(255) NOT NULL,
      category ENUM('Medical Report', 'Lab Report', 'Prescription', 'Referral', 'Insurance', 'Other') NOT NULL DEFAULT 'Medical Report',
      document_type VARCHAR(100) NULL,
      file_path VARCHAR(500) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
      file_size_kb INT NOT NULL DEFAULT 150,
      medical_record_id INT NULL,
      lab_order_id INT NULL,
      prescription_id INT NULL,
      uploaded_by INT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_doc_patient (patient_id),
      INDEX idx_doc_category (category),
      INDEX idx_doc_status (status),
      INDEX idx_doc_uploaded (uploaded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
  `);

  // Ensure all enhanced columns exist
  const [cols] = await db.query('DESCRIBE patient_documents');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('category')) {
    await db.query("ALTER TABLE patient_documents ADD COLUMN category ENUM('Medical Report', 'Lab Report', 'Prescription', 'Referral', 'Insurance', 'Other') NOT NULL DEFAULT 'Medical Report' AFTER document_name");
  }
  if (!colNames.includes('file_name')) {
    await db.query("ALTER TABLE patient_documents ADD COLUMN file_name VARCHAR(255) NOT NULL DEFAULT 'document.pdf' AFTER file_path");
  }
  if (!colNames.includes('mime_type')) {
    await db.query("ALTER TABLE patient_documents ADD COLUMN mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf' AFTER file_name");
  }
  if (!colNames.includes('medical_record_id')) {
    await db.query('ALTER TABLE patient_documents ADD COLUMN medical_record_id INT NULL AFTER file_size_kb');
  }
  if (!colNames.includes('lab_order_id')) {
    await db.query('ALTER TABLE patient_documents ADD COLUMN lab_order_id INT NULL AFTER medical_record_id');
  }
  if (!colNames.includes('prescription_id')) {
    await db.query('ALTER TABLE patient_documents ADD COLUMN prescription_id INT NULL AFTER lab_order_id');
  }
  if (!colNames.includes('status')) {
    await db.query("ALTER TABLE patient_documents ADD COLUMN status ENUM('active', 'archived', 'deleted') NOT NULL DEFAULT 'active' AFTER uploaded_at");
  }

  // Update existing rows with accurate category and file_name if default
  await db.query(`
    UPDATE patient_documents SET 
      category = CASE 
        WHEN document_name LIKE '%ECG%' OR document_name LIKE '%Diagnostic%' THEN 'Medical Report'
        WHEN document_name LIKE '%Calcium%' OR document_name LIKE '%MRI%' OR document_name LIKE '%CT%' THEN 'Lab Report'
        WHEN document_name LIKE '%Insurance%' OR document_name LIKE '%ID%' THEN 'Insurance'
        WHEN document_name LIKE '%Prescription%' THEN 'Prescription'
        WHEN document_name LIKE '%Discharge%' OR document_name LIKE '%Referral%' THEN 'Referral'
        ELSE 'Medical Report'
      END,
      file_name = CONCAT('doc_', id, '.pdf'),
      file_path = CONCAT('storage/documents/doc_', id, '.pdf'),
      mime_type = 'application/pdf',
      status = 'active'
    WHERE category IS NULL OR file_name = 'document.pdf'
  `);

  console.log('🎉 Secure Patient Document Management Module Migration Completed Successfully!');
}

if (require.main === module) {
  migrateDocumentModule()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    });
}

module.exports = migrateDocumentModule;
