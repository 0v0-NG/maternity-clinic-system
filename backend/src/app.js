const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const db = require('./config/database');
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
// If set to '*', origin is set to true to reflect request origin so credentials: true works without browser wildcard rejection
const allowedOrigins = config.corsOrigin === '*'
  ? true
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
  max: config.env === 'production' ? 100 : 2000,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});
app.use('/api', limiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.env === 'production' ? 20 : 1000,
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
    message:
      'For emergencies, please go directly to the Emergency Unit. This system is for scheduled clinic appointments only.',
  });
});

// --- Public Clinic Information ---
app.get('/api/clinic-info', async (req, res, next) => {
  try {
    const clinics = await db('clinics').select('name', 'slot_duration_min');
    const ancClinic = clinics.find((c) => {
      const n = c.name.toLowerCase();
      return n.includes('antenatal') || n.includes('ante-natal');
    });
    const pncClinic = clinics.find((c) => {
      const n = c.name.toLowerCase();
      return n.includes('postnatal') || n.includes('post-natal');
    });

    res.json({
      success: true,
      data: {
        ...clinicInfo,
        clinicDaysAndHours: {
          antenatal: {
            ...clinicInfo.clinicDaysAndHours.antenatal,
            slotDurationMinutes: ancClinic ? ancClinic.slot_duration_min : null,
          },
          postnatal: {
            ...clinicInfo.clinicDaysAndHours.postnatal,
            slotDurationMinutes: pncClinic ? pncClinic.slot_duration_min : null,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
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
