const mysql = require('mysql2/promise');
const config = require('./env');

const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
  ssl: (config.db.host && config.db.host !== '127.0.0.1' && config.db.host !== 'localhost') ? { rejectUnauthorized: false } : undefined
});

// Helper for test connection / health check
async function testConnection() {
  const startTime = Date.now();
  try {
    const connection = await pool.getConnection();
    await connection.query('SELECT 1');
    connection.release();
    const latencyMs = Date.now() - startTime;
    return { connected: true, latencyMs, error: null };
  } catch (error) {
    return { connected: false, latencyMs: Date.now() - startTime, error: error.message };
  }
}

// Transaction wrapper helper
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  getConnection: () => pool.getConnection(),
  testConnection,
  withTransaction
};
