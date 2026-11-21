const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config');
const smsService = require('../services/sms.service');
const { formatPhone, generateId } = require('../utils/helpers');
const { AppError } = require('../middleware/errorHandler');

/**
 * Register a new mother account.
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { phone, name, password } = req.body;
    const formattedPhone = formatPhone(phone);

    // Check if phone already exists
    const existing = await db('mothers').where('phone', formattedPhone).first();
    if (existing) {
      throw new AppError('An account with this phone number already exists.', 409);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create mother record
    const id = generateId();
    await db('mothers').insert({
      id,
      phone: formattedPhone,
      name,
      password_hash: passwordHash,
      is_verified: false,
      role: 'mother',
      created_at: new Date(),
    });

    // Send OTP for verification
    const otpResult = await smsService.sendOTP(formattedPhone);

    // Log the action
    await db('audit_logs').insert({
      id: generateId(),
      user_id: id,
      action: 'REGISTER',
      details: JSON.stringify({ phone: formattedPhone }),
      created_at: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your phone number with the OTP sent.',
      data: {
        motherId: id,
        pinId: otpResult.pinId,
        demoOtp: otpResult.otp || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify phone number with OTP.
 * POST /api/auth/verify-otp
 */
const verifyOTP = async (req, res, next) => {
  try {
    const { pinId, otp, motherId } = req.body;

    const result = await smsService.verifyOTP(pinId, otp);

    if (result.verified === true || result.verified === 'True') {
      await db('mothers').where('id', motherId).update({ is_verified: true });

      // Generate token
      const mother = await db('mothers').where('id', motherId).first();
      const token = generateToken(mother);

      res.json({
        success: true,
        message: 'Phone number verified successfully.',
        data: { token },
      });
    } else {
      throw new AppError('Invalid or expired OTP. Please try again.', 400);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Login with phone and password.
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const formattedPhone = formatPhone(phone);

    // Find user (could be mother or staff)
    let user = await db('mothers').where('phone', formattedPhone).first();
    let role = 'mother';

    if (!user) {
      user = await db('staff').where('phone', formattedPhone).first();
      if (user) role = user.role;
    }

    if (!user) {
      throw new AppError('Invalid phone number or password.', 401);
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid phone number or password.', 401);
    }

    // Check if mother account is verified
    if (role === 'mother' && !user.is_verified) {
      throw new AppError('Please verify your phone number before logging in.', 403);
    }

    const token = generateToken({ ...user, role });
    const refreshToken = generateRefreshToken({ ...user, role });

    // Log the action
    await db('audit_logs').insert({
      id: generateId(),
      user_id: user.id,
      action: 'LOGIN',
      details: JSON.stringify({ phone: formattedPhone, role }),
      created_at: new Date(),
    });

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh an expired access token.
 * POST /api/auth/refresh-token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw new AppError('Refresh token is required.', 400);
    }

    const decoded = jwt.verify(token, config.jwt.secret + '_refresh');
    const newToken = generateToken({ id: decoded.id, role: decoded.role, name: decoded.name });

    res.json({
      success: true,
      data: { token: newToken },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token. Please log in again.',
      });
    }
    next(error);
  }
};

// --- Helpers ---

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    config.jwt.secret + '_refresh',
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

module.exports = { register, verifyOTP, login, refreshToken };
