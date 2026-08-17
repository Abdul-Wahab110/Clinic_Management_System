const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const config = require('./config/env');
const { testConnection } = require('./config/db');
const { corsMiddleware, helmetMiddleware, apiLimiter } = require('./middleware/security');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/index');

const app = express();

// Security Headers & Cross-Origin Resource Sharing
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Request Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Serve Static Assets from /public (CSS, JS, images)
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// Apply API Rate Limiting to /api
app.use('/api', apiLimiter);

// Mount API Routes
app.use('/api', apiRoutes);

// =======================================================
// TRUE MULTI-PAGE APPLICATION (MPA) ROUTE DISPATCHER
// Maps clean URLs directly to their dedicated HTML files
// =======================================================

// 1. Root Public Hospital Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Helper function to serve HTML file safely
function servePage(res, filePath) {
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }
  return res.status(404).sendFile(path.join(publicDir, 'pages/404.html'));
}

// 2. Admin Module Pages (/admin/*)
app.get('/search', (req, res) => {
  servePage(res, path.join(publicDir, 'admin/search.html'));
});
app.get('/admin', (req, res) => {
  servePage(res, path.join(publicDir, 'admin/dashboard.html'));
});
app.get('/admin/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `admin/${pageName}.html`));
});

// 3. Doctor Module Pages (/doctor/*)
app.get('/doctor', (req, res) => {
  servePage(res, path.join(publicDir, 'doctor/dashboard.html'));
});
app.get('/doctor/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `doctor/${pageName}.html`));
});

// 4. Patient Module Pages (/patient/*)
app.get('/patient', (req, res) => {
  servePage(res, path.join(publicDir, 'patient/dashboard.html'));
});
app.get('/patient/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `patient/${pageName}.html`));
});

// 5. Receptionist Module Pages (/reception/*)
app.get('/reception', (req, res) => {
  servePage(res, path.join(publicDir, 'reception/dashboard.html'));
});
app.get('/reception/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `reception/${pageName}.html`));
});

// 6. Nurse Module Pages (/nurse/*)
app.get('/nurse', (req, res) => {
  servePage(res, path.join(publicDir, 'nurse/dashboard.html'));
});
app.get('/nurse/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `nurse/${pageName}.html`));
});

// 7. Lab Technician Module Pages (/lab/*)
app.get('/lab', (req, res) => {
  servePage(res, path.join(publicDir, 'lab/dashboard.html'));
});
app.get('/lab/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `lab/${pageName}.html`));
});

// 8. Pharmacist Module Pages (/pharmacy/*)
app.get('/pharmacy', (req, res) => {
  servePage(res, path.join(publicDir, 'pharmacy/dashboard.html'));
});
app.get('/pharmacy/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `pharmacy/${pageName}.html`));
});

// 9. Accountant / Billing Module Pages (/billing/*)
app.get('/billing', (req, res) => {
  servePage(res, path.join(publicDir, 'billing/dashboard.html'));
});
app.get('/billing/:page', (req, res) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  servePage(res, path.join(publicDir, `billing/${pageName}.html`));
});

// 10. Public Blog SEO Article URL (/blog/:slug)
app.get('/blog/:slug', (req, res, next) => {
  if (req.params.slug && req.params.slug !== 'blog') {
    return res.sendFile(path.join(publicDir, 'pages/blog-details.html'));
  }
  next();
});

// 11. Public Pages (/about, /departments, /doctors, /services, /appointments, /emergency, /blog, /faq, /contact, /login, /register, etc.)
app.get('/:page', (req, res, next) => {
  const pageName = req.params.page.replace(/\.html$/, '');
  const candidatePath = path.join(publicDir, `pages/${pageName}.html`);
  if (fs.existsSync(candidatePath)) {
    return res.sendFile(candidatePath);
  }
  next();
});

// 404 Handler for HTML views
app.use((req, res, next) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(publicDir, 'pages/404.html'));
  }
  next();
});

// Centralized API 404 and Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server with Automatic Port in-use Fallback
function startServer(port, retries = 10) {
  const server = app.listen(port, async () => {
    config.port = port;
    console.log('====================================================');
    console.log(`🏥 ${config.appName} - Backend Server Live (True MPA Architecture)`);
    console.log(`📡 URL: http://localhost:${port}`);
    console.log(`🩺 Healthcheck: http://localhost:${port}/api/health`);
    console.log(`🔐 Mode: ${config.nodeEnv}`);
    console.log('====================================================');

    const dbCheck = await testConnection();
    if (dbCheck.connected) {
      console.log(`✅ MySQL Database Connected successfully (Latency: ${dbCheck.latencyMs}ms)`);
    } else {
      console.error(`❌ MySQL Database Connection Failed: ${dbCheck.error}`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (retries > 0) {
        const nextPort = port + 1;
        console.warn(`⚠️ Port ${port} is currently in use. Automatically switching to port ${nextPort}...`);
        startServer(nextPort, retries - 1);
      } else {
        console.error(`❌ Port ${port} and consecutive fallback ports are already in use.`);
        console.error(`👉 Please close conflicting processes or update PORT in .env.`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
    }
  });

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  startServer(config.port);
}

module.exports = { app, startServer };
