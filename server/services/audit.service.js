const db = require('../config/db');
const { NotFoundError } = require('../utils/errors');

/**
 * 1. Log New Audit Event (Append-Only)
 */
async function logAuditEvent(data) {
  const userId = data.user_id ? parseInt(data.user_id, 10) : null;
  const userName = data.user_name || null;
  const userRole = data.user_role || null;
  const action = (data.action || 'SYSTEM_ACTION').toUpperCase().trim();
  const moduleName = (data.module || data.entity || 'SYSTEM').toUpperCase().trim();
  const recordId = data.record_id || data.entity_id ? String(data.record_id || data.entity_id) : null;
  const ipAddress = data.ip_address || '127.0.0.1';
  const userAgent = data.user_agent || null;
  const description = data.description ? data.description.trim() : `${action} on ${moduleName} #${recordId || 'N/A'}`;
  const detailsJson = data.details_json 
    ? (typeof data.details_json === 'object' ? JSON.stringify(data.details_json) : String(data.details_json))
    : (data.details ? (typeof data.details === 'object' ? JSON.stringify(data.details) : String(data.details)) : null);

  const [res] = await db.query(
    `INSERT INTO audit_logs 
     (user_id, user_name, user_role, action, module, entity, entity_id, record_id, ip_address, user_agent, description, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      userId,
      userName,
      userRole,
      action,
      moduleName,
      moduleName.toLowerCase(),
      recordId,
      recordId,
      ipAddress,
      userAgent,
      description,
      detailsJson
    ]
  );

  return {
    id: res.insertId,
    action,
    module: moduleName,
    record_id: recordId,
    user_name: userName,
    created_at: new Date()
  };
}

/**
 * 2. List Audit Logs with Multi-Criteria Filters & Summary KPIs (Admin Only)
 */
async function listAuditLogs(query = {}) {
  const { action, module: mod, user_id, timeframe, date_from, date_to, search, page = 1, limit = 50 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];

  if (action && action !== 'all') {
    conditions.push('UPPER(a.action) = ?');
    params.push(action.toUpperCase().trim());
  }

  if (mod && mod !== 'all') {
    conditions.push('UPPER(COALESCE(NULLIF(a.module, \'SYSTEM\'), a.entity, a.module, \'SYSTEM\')) = ?');
    params.push(mod.toUpperCase().trim());
  }

  if (user_id && user_id !== 'all') {
    conditions.push('a.user_id = ?');
    params.push(parseInt(user_id, 10));
  }

  // Dynamic Timeframe Filtering
  if (timeframe) {
    switch (timeframe.toLowerCase()) {
      case 'today':
        conditions.push('DATE(a.created_at) = CURDATE()');
        break;
      case 'yesterday':
        conditions.push('DATE(a.created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)');
        break;
      case 'this_week':
        conditions.push('YEARWEEK(a.created_at, 1) = YEARWEEK(CURDATE(), 1)');
        break;
      case 'this_month':
        conditions.push('YEAR(a.created_at) = YEAR(CURDATE()) AND MONTH(a.created_at) = MONTH(CURDATE())');
        break;
      case 'this_year':
        conditions.push('YEAR(a.created_at) = YEAR(CURDATE())');
        break;
    }
  }

  if (date_from) {
    conditions.push('DATE(a.created_at) >= ?');
    params.push(date_from);
  }

  if (date_to) {
    conditions.push('DATE(a.created_at) <= ?');
    params.push(date_to);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    conditions.push('(a.action LIKE ? OR a.module LIKE ? OR a.entity LIKE ? OR a.description LIKE ? OR a.user_name LIKE ? OR a.ip_address LIKE ? OR a.record_id LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(term, term, term, term, term, term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Summary Metrics Across All Audit Events
  const [metricsRows] = await db.query(`
    SELECT 
      COUNT(id) as total_events,
      SUM(CASE WHEN UPPER(action) IN ('LOGIN', 'LOGOUT') THEN 1 ELSE 0 END) as auth_events,
      SUM(CASE WHEN UPPER(action) IN ('MEDICAL_RECORD_ACCESS', 'PRESCRIPTION_CHANGE') THEN 1 ELSE 0 END) as clinical_events,
      SUM(CASE WHEN UPPER(action) IN ('BILLING_CHANGE', 'PAYMENT_CHANGE') THEN 1 ELSE 0 END) as financial_events,
      SUM(CASE WHEN UPPER(action) IN ('PERMISSION_CHANGE', 'ACCOUNT_STATUS_CHANGE') THEN 1 ELSE 0 END) as security_events,
      SUM(CASE WHEN UPPER(action) IN ('CREATE', 'UPDATE', 'DELETE') THEN 1 ELSE 0 END) as crud_events
    FROM audit_logs
  `);

  const [countRows] = await db.query(
    `SELECT COUNT(*) as total FROM audit_logs a 
     LEFT JOIN users u ON a.user_id = u.id 
     ${whereClause}`,
    params
  );
  const total = countRows[0].total;

  const [rows] = await db.query(
    `SELECT 
      a.id, a.user_id, UPPER(a.action) as action, UPPER(COALESCE(NULLIF(a.module, 'SYSTEM'), a.entity, a.module, 'SYSTEM')) as module,
      a.record_id, a.ip_address, a.user_agent, a.description, a.details_json, a.created_at,
      COALESCE(u.full_name, a.user_name, 'System / Automated') as user_name,
      COALESCE(r.name, a.user_role, 'system') as user_role,
      u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    ${whereClause}
    ORDER BY a.id DESC
    LIMIT ? OFFSET ?`,
    [...params, limitNum, offset]
  );

  const m = metricsRows[0];

  return {
    logs: rows,
    metrics: {
      total_events: m.total_events || 0,
      auth_events: m.auth_events || 0,
      clinical_events: m.clinical_events || 0,
      financial_events: m.financial_events || 0,
      security_events: m.security_events || 0,
      crud_events: m.crud_events || 0
    },
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
}

/**
 * 3. Get Audit Log by ID
 */
async function getAuditLogById(id) {
  const [rows] = await db.query(
    `SELECT 
      a.id, a.user_id, UPPER(a.action) as action, UPPER(COALESCE(a.module, a.entity, 'SYSTEM')) as module,
      a.record_id, a.ip_address, a.user_agent, a.description, a.details_json, a.created_at,
      COALESCE(u.full_name, a.user_name, 'System / Automated') as user_name,
      COALESCE(r.name, a.user_role, 'system') as user_role,
      u.email as user_email
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE a.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    throw new NotFoundError('Audit log entry not found.');
  }

  const log = rows[0];
  let parsedDetails = null;
  if (log.details_json) {
    try {
      parsedDetails = JSON.parse(log.details_json);
    } catch (_) {
      parsedDetails = log.details_json;
    }
  }

  return {
    ...log,
    parsed_details: parsedDetails
  };
}

/**
 * 4. Get Audit Analytics & Distribution Stats
 */
async function getAuditStats() {
  const [actionDist] = await db.query(`
    SELECT UPPER(action) as action, COUNT(id) as count 
    FROM audit_logs 
    GROUP BY UPPER(action) 
    ORDER BY count DESC 
    LIMIT 10
  `);

  const [moduleDist] = await db.query(`
    SELECT UPPER(COALESCE(module, entity, 'SYSTEM')) as module, COUNT(id) as count 
    FROM audit_logs 
    GROUP BY UPPER(COALESCE(module, entity, 'SYSTEM')) 
    ORDER BY count DESC 
    LIMIT 10
  `);

  const [recentActors] = await db.query(`
    SELECT COALESCE(user_name, 'System') as actor, COUNT(id) as actions_count
    FROM audit_logs
    GROUP BY actor
    ORDER BY actions_count DESC
    LIMIT 8
  `);

  return {
    action_distribution: actionDist,
    module_distribution: moduleDist,
    top_actors: recentActors
  };
}

module.exports = {
  logAuditEvent,
  listAuditLogs,
  getAuditLogById,
  getAuditStats
};
