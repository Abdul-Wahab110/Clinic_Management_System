const db = require('../config/db');

const logger = {
  info: (msg, meta = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? meta : '');
  },
  warn: (msg, meta = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, Object.keys(meta).length ? meta : '');
  },
  error: (msg, err = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err);
  },
  
  // Database Audit Logging for security & operational tracking
  audit: async (userId, action, entity, entityId = null, ip = null, userAgent = null, details = null, conn = null) => {
    try {
      const detailsJson = details ? JSON.stringify(details) : null;
      const client = conn || db;
      await client.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address, user_agent, details_json) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId || null, action, entity, entityId ? String(entityId) : null, ip, userAgent, detailsJson]
      );
    } catch (auditErr) {
      console.error('[AUDIT LOG FAILED]', auditErr.message);
    }
  }
};

module.exports = logger;
