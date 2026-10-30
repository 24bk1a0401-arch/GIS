/**
 * GeoSafe GIS - Main Express Server Application
 * Community Emergency Support Platform & Secure Admin Dashboard
 */

require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { initializeSchema } = require('./src/database/schema');
const { seedDatabase } = require('./src/database/seed');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Security Headers (Configured to allow Leaflet tiles and CDN resources)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
app.use(cors({
  origin: true,
  credentials: true
}));

// Body Parsers & Cookie Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'geosafe_cookie_secret'));

// General Rate Limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api', generalLimiter);

// Strict Rate Limiter for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: 'Too many authentication attempts. Please wait 15 minutes before retrying.' }
});
app.use('/api/auth/login', loginLimiter);

// Incident Report Rate Limiter
const incidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  message: { success: false, error: 'Report limit reached for this session. Please try again later.' }
});
app.use('/api/incidents', incidentLimiter);

// API Route Mounts
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/services', require('./src/routes/services'));
app.use('/api/risk-zones', require('./src/routes/riskZones'));
app.use('/api/incidents', require('./src/routes/incidents'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/public', require('./src/routes/public'));

// Static File Directories
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// HTML Page Routing
app.get('/ui.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'ui.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/login.html'));
});

app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/index.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.message);
  if (err.message && err.message.includes('Invalid file format')) {
    return res.status(400).json({ success: false, error: err.message });
  }
  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message
  });
});

// Server Startup
async function startServer() {
  try {
    console.log('[STARTUP] Initializing database...');
    await initializeSchema();
    await seedDatabase();

    const server = app.listen(PORT, () => {
      console.log('================================================================');
      console.log(` GeoSafe GIS - Emergency Support & Admin Platform is active!`);
      console.log(` Public Portal:      http://localhost:${PORT}/`);
      console.log(` Admin Login:        http://localhost:${PORT}/admin/login`);
      console.log(` Admin Dashboard:    http://localhost:${PORT}/admin`);
      console.log(` API Health Check:   http://localhost:${PORT}/api/public/settings`);
      console.log('================================================================');
    });

    return server;
  } catch (err) {
    console.error('[STARTUP] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
