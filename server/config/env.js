require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  appName: process.env.APP_NAME || 'AuraCare Medical Center',
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'clinic_management',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10)
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'super_secret_clinic_jwt_token_key_change_in_production_2026',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshExpiresIn: '7d'
  },

  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '300', 10)
  }
};
