const { testConnection } = require('../config/db');
const config = require('../config/env');

const startTime = Date.now();

async function checkSystemHealth() {
  const dbHealth = await testConnection();
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbHealth.connected;

  return {
    status: isHealthy ? 'healthy' : 'degraded',
    version: '1.0.0',
    service: config.appName,
    environment: config.nodeEnv,
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealth.connected ? 'connected' : 'disconnected',
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024)
      }
    }
  };
}

module.exports = {
  checkSystemHealth
};
