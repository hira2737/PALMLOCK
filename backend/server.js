
/**
 * PALMLOCK — Touch Beyond Vision
 * Core Backend Server & Security API
 *
 * Node.js, Express, MongoDB/Mongoose, Socket.IO
 */

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { connectDB, getConnectionState } = require('./config/db');
const { initSocketIO } = require('./sockets/socketHandler');
const { startEscalationScheduler } = require('./services/escalationService');
const { apiLimiter } = require('./middleware/rateLimiter');
const { verifyToken, requireRole } = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// API route imports
const authRoutes = require('./routes/authRoutes');
const contactRoutes = require('./routes/contactRoutes');
const pinRoutes = require('./routes/pinRoutes');
const merchantRoutes = require('./routes/merchantRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const alertRoutes = require('./routes/alertRoutes');
const auditRoutes = require('./routes/auditRoutes');

const app = express();
const server = http.createServer(app);

initSocketIO(server);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
const allowedOrigins = process.env.CLIENT_ORIGINS
  ? process.env.CLIENT_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    ];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Idempotency-Key'
    ]
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// General API rate limiting
app.use('/api', apiLimiter);

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    database: getConnectionState(),
    environment: process.env.NODE_ENV || 'development',
    service: 'PALMLOCK Security & Emergency Backend'
  });
});

/**
 * Central administrator authorization.
 *
 * Every endpoint under /api/admin requires:
 * 1. A valid JWT
 * 2. An administrator role
 *
 * This middleware runs BEFORE all API route mounts.
 * Mobile emergency submission endpoints are not affected.
 */
app.use(
  '/api/admin',
  verifyToken,
  requireRole('admin')
);

// Authentication and account routes
app.use('/api/auth', authRoutes);

// User-facing routes
app.use('/api/contacts', contactRoutes);
app.use('/api/pin', pinRoutes);
app.use('/api/merchants', merchantRoutes);
app.use('/api', merchantRoutes);

// Transaction routes
app.use('/api/transactions', transactionRoutes);
app.use('/api', transactionRoutes);

// Emergency routes
app.use('/api/alerts', alertRoutes);
app.use('/api', alertRoutes);

// Administrative audit routes
app.use('/api', auditRoutes);

// Serve the frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Unmatched API routes
app.use('/api/*', notFoundHandler);

// Central error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== 'test') {
  connectDB().then(() => {
    startEscalationScheduler(30000);

    server.listen(PORT, () => {
      console.log('\n======================================================');
      console.log('  PALMLOCK Security & Emergency Backend Started');
      console.log(`  Port: ${PORT}`);
      console.log(`  Health Check: http://localhost:${PORT}/api/health`);
      console.log(`  Database Status: ${getConnectionState()}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('======================================================\n');
    });
  });
}

module.exports = { app, server };
