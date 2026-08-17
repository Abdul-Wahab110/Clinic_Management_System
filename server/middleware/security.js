const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const config = require('../config/env');

// CORS configuration
const corsMiddleware = cors({
  origin: config.security.corsOrigin === '*' ? true : config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Helmet security headers (with loose CSP for self-hosted scripts/styles)
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.nodeEnv === 'test' ? 50000 : config.security.rateLimitMax,
  skip: (req) => config.nodeEnv === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.hostname === 'localhost',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP. Please try again later.',
    timestamp: new Date().toISOString()
  }
});

// Stricter rate limiter for authentication endpoints (login, forgot-password, reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.nodeEnv === 'test' ? 10000 : 100,
  skip: (req) => config.nodeEnv === 'test' || req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.hostname === 'localhost',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    statusCode: 429,
    errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    timestamp: new Date().toISOString()
  }
});

module.exports = {
  corsMiddleware,
  helmetMiddleware,
  apiLimiter,
  authLimiter
};
