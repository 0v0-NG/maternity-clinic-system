require('dotenv').config();

/**
 * Central configuration for the application.
 * All environment variables are read here and exported as a single object.
 */
module.exports = {
  // Server
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

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
    secret: (() => {
      const secret = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test_jwt_secret_min_32_characters_long' : null);
      if (!secret) throw new Error('FATAL: JWT_SECRET environment variable is missing.');
      return secret;
    })(),
    refreshSecret: (() => {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'test' ? 'test_jwt_refresh_secret_min_32_chars' : null);
      if (!refreshSecret) throw new Error('FATAL: JWT_REFRESH_SECRET environment variable is missing.');
      return refreshSecret;
    })(),
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
