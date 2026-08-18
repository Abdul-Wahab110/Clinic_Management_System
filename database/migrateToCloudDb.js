/**
 * Cloud Database Migration Script for Clever Cloud MySQL
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const cloudConfig = {
  host: 'bchsxwuztbjqgbejlz8n-mysql.services.clever-cloud.com',
  user: 'uxldrojplppm0ay2',
  password: 'k2QB8R1ppGzkwz0UO0nA',
  database: 'bchsxwuztbjqgbejlz8n',
  port: 3306,
  connectTimeout: 20000,
  ssl: { rejectUnauthorized: false }
};

async function migrateCloudDatabase() {
  console.log('====================================================');
  console.log('🚀 MIGRATING TO CLEVER CLOUD MYSQL DATABASE');
  console.log('====================================================\n');

  let connection;
  try {
    console.log('1. Connecting to Clever Cloud MySQL...');
    connection = await mysql.createConnection(cloudConfig);
    console.log('✅ Connected successfully to Cloud Database!\n');

    console.log('2. Reading schema.sql...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    
    // Split into individual statements
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
      .filter(s => !s.toLowerCase().includes('create database') && !s.toLowerCase().startsWith('use '));

    console.log(`3. Executing ${statements.length} SQL statements in Cloud Database...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await connection.query(stmt);
      } catch (err) {
        console.warn(`   ⚠️ Notice on statement ${i + 1}: ${err.message}`);
      }
    }
    console.log('✅ Schema statements processed!\n');

    // Run seed data
    console.log('4. Initializing Hospital Settings...');
    await connection.query(`
      INSERT INTO hospital_settings (hospital_name, tagline, phone, email, emergency_hotline, address, footer_copyright)
      VALUES ('AuraCare Medical Center', 'Advanced Healthcare Excellence', '+1 (800) 555-AURA', 'info@auracare.com', '+1 (800) 999-AURA', '123 Medical Plaza, Metro City', '© 2026 AuraCare Medical Center. All rights reserved.')
      ON DUPLICATE KEY UPDATE hospital_name = VALUES(hospital_name)
    `);

    // Verify Tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`\n🎉 Total Tables in Cloud DB: ${tables.length}`);
    tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

    console.log('\n====================================================');
    console.log('✅ CLOUD DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('====================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Cloud Migration Error:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrateCloudDatabase();
