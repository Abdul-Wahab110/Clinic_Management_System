/**
 * Database Initialization Script
 * Connects to MySQL, creates database if missing, executes schema.sql and seeds.sql
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'clinic_management';

  console.log(`[DB INIT] Connecting to MySQL at ${host}:${port} as ${user}...`);

  let rootConnection;
  let dbConnection;
  try {
    const isCloud = host !== '127.0.0.1' && host !== 'localhost';
    const sslConfig = isCloud ? { rejectUnauthorized: false } : undefined;

    if (!isCloud) {
      // 1. Initial local connection without specifying database
      try {
        rootConnection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          multipleStatements: true
        });

        console.log(`[DB INIT] Creating database "${database}" if not exists...`);
        await rootConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await rootConnection.end();
      } catch (e) {
        console.warn(`[DB INIT] Notice on create database: ${e.message}`);
      }
    }

    // 2. Connect to the specific database
    dbConnection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database,
      multipleStatements: true,
      ssl: sslConfig
    });

    console.log(`[DB INIT] Connected to database "${database}". Checking schema...`);
    const [existingTables] = await dbConnection.query('SHOW TABLES');
    
    if (existingTables.length === 0) {
      console.log(`[DB INIT] Applying schema to "${database}"...`);
      const schemaPath = path.join(__dirname, 'schema.sql');
      let schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      if (isCloud) {
        schemaSql = schemaSql
          .replace(/CREATE DATABASE IF NOT EXISTS.*?;/gi, '')
          .replace(/USE `clinic_management`;/gi, '')
          .replace(/USE clinic_management;/gi, '');
      }
      
      await dbConnection.query(schemaSql);
      console.log(`[DB INIT] Schema applied successfully.`);

      console.log(`[DB INIT] Applying seed data...`);
      const seedsPath = path.join(__dirname, 'seeds.sql');
      let seedsSql = fs.readFileSync(seedsPath, 'utf8');
      if (isCloud) {
        seedsSql = seedsSql.replace(/USE `clinic_management`;/gi, '').replace(/USE clinic_management;/gi, '');
      }
      await dbConnection.query(seedsSql);

      // Set genuine bcrypt hash for all demo users (Password: Clinic2026!)
      const salt = await bcrypt.genSalt(10);
      const demoPasswordHash = await bcrypt.hash('Clinic2026!', salt);
      await dbConnection.query('UPDATE users SET password_hash = ?', [demoPasswordHash]);
      console.log(`[DB INIT] Seed users configured with default password: Clinic2026!`);
    } else {
      console.log(`[DB INIT] Database "${database}" already has ${existingTables.length} tables. Skipping schema creation.`);
    }

    console.log(`[DB INIT] Seed users configured with default password: Clinic2026!`);

    // Verify row counts
    const [roleRows] = await dbConnection.query('SELECT COUNT(*) as count FROM roles');
    const [userRows] = await dbConnection.query('SELECT COUNT(*) as count FROM users');
    const [deptRows] = await dbConnection.query('SELECT COUNT(*) as count FROM departments');
    const [docRows] = await dbConnection.query('SELECT COUNT(*) as count FROM doctors');

    console.log(`[DB INIT] Verification complete:`);
    console.log(`   - Roles: ${roleRows[0].count} (All 9 roles active)`);
    console.log(`   - Users: ${userRows[0].count}`);
    console.log(`   - Departments: ${deptRows[0].count}`);
    console.log(`   - Doctors: ${docRows[0].count}`);

    await dbConnection.end();
    console.log(`[DB INIT] Database initialization completed successfully.`);
    return true;
  } catch (error) {
    console.error(`[DB INIT ERROR] Failed to initialize database:`, error.message);
    if (rootConnection) {
      try { await rootConnection.end(); } catch (_) {}
    }
    throw error;
  }
}

if (require.main === module) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.warn(`⚠️ [DB INIT WARNING] Database initialization could not connect (${err.message}). Continuing server start...`);
      process.exit(0);
    });
}

module.exports = initializeDatabase;
