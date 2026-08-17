const { pool } = require('../server/config/db');
const fs = require('fs');
const path = require('path');

async function migrateBranding() {
  console.log('--- 1. Migrating hospital_settings columns in MySQL ---');
  
  // Ensure columns exist in hospital_settings
  const [cols] = await pool.query('DESCRIBE hospital_settings');
  const fieldNames = cols.map(c => c.Field);

  if (!fieldNames.includes('favicon_url')) {
    await pool.query('ALTER TABLE hospital_settings ADD COLUMN favicon_url VARCHAR(500) NULL AFTER logo_url');
    console.log('  Added favicon_url column to hospital_settings');
  }

  if (!fieldNames.includes('footer_copyright')) {
    await pool.query('ALTER TABLE hospital_settings ADD COLUMN footer_copyright VARCHAR(255) NULL AFTER address');
    console.log('  Added footer_copyright column to hospital_settings');
  }

  // Update default values if empty
  await pool.query(`
    UPDATE hospital_settings SET
      footer_copyright = COALESCE(footer_copyright, '© 2026 AuraCare Medical Center & Super Specialty Institute. All rights reserved.'),
      favicon_url = COALESCE(favicon_url, '/favicon.ico')
    WHERE id = 1
  `);

  // Ensure uploads directories exist
  const uploadsDir = path.join(__dirname, '../public/uploads');
  const brandingDir = path.join(uploadsDir, 'branding');
  const docsDir = path.join(uploadsDir, 'documents');

  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  console.log('  Uploads directories verified:', brandingDir);
  console.log('✅ Branding migration completed successfully!\n');
  process.exit(0);
}

migrateBranding().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
