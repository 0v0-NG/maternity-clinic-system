const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { errorHandler } = require('./middleware/errorHandler');
const clinicInfo = require('./config/clinicInfo');

// Route imports
const authRoutes = require('./routes/auth.routes');
const motherRoutes = require('./routes/mother.routes');
const babyRoutes = require('./routes/baby.routes');
const clinicRoutes = require('./routes/clinic.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const queueRoutes = require('./routes/queue.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// --- Global Middleware ---
app.use(helmet());

// CORS configuration (configurable via CORS_ORIGIN, defaults to http://localhost:3000)
const allowedOrigins = config.corsOrigin === '*'
  ? '*'
  : config.corsOrigin.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
app.use('/api', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again later.',
  },
});
app.use('/api/auth', authLimiter);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Antenatal & Postnatal Appointment System API is running.',
    timestamp: new Date().toISOString(),
  });
});

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/mothers', motherRoutes);
app.use('/api/babies', babyRoutes);
app.use('/api/clinics', clinicRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/admin', adminRoutes);

// --- Emergency Notice ---
app.get('/api/emergency-notice', (req, res) => {
  res.json({
    success: true,
    message: 'For emergencies, please proceed directly to the Emergency Unit. This system is for scheduled clinic visits only.',
  });
});

// --- Public Clinic Information ---
app.get('/api/clinic-info', (req, res) => {
  res.json({
    success: true,
    data: clinicInfo,
  });
});

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found.`,
    },
    message: `Route ${req.method} ${req.originalUrl} not found.`,
  });
});

// --- Global Error Handler ---
app.use(errorHandler);

module.exports = app;
