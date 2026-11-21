require('dotenv').config();

/**
 * Central configuration for the application.
 * All environment variables are read here and exported as a single object.
 */
module.exports = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    name: process.env.DB_NAME || 'antenatal_postnatal_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT Authentication
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Termii SMS Gateway
  sms: {
    apiKey: process.env.SMS_API_KEY || '',
    senderId: process.env.SMS_SENDER_ID || 'ANCClinic',
    baseUrl: 'https://api.ng.termii.com/api',
  },

  // Appointment rules
  cancelCutoffHours: parseInt(process.env.CANCEL_CUTOFF_HOURS, 10) || 4,
  walkinReservePct: parseFloat(process.env.WALKIN_RESERVE_PCT) || 0.2,
  reminderHours: (process.env.REMINDER_HOURS || '24,2')
    .split(',')
    .map((h) => parseInt(h.trim(), 10)),
};
