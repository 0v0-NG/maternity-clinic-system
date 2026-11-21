const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post(
  '/register',
  validate([
    body('phone').notEmpty().withMessage('Phone number is required.'),
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters.'),
    body('consent')
      .custom((val) => val === true || val === 'true')
      .withMessage('Consent under the Nigeria Data Protection Act 2023 is required.'),
  ]),
  authController.register
);

router.post(
  '/verify-otp',
  validate([
    body('pinId').notEmpty().withMessage('Pin ID is required.'),
    body('otp')
      .isLength({ min: 6, max: 6 })
      .withMessage('OTP must be 6 digits.'),
    body('motherId').notEmpty().withMessage('Mother ID is required.'),
  ]),
  authController.verifyOTP
);

router.post(
  '/resend-otp',
  validate([
    body('phone').notEmpty().withMessage('Phone number is required.'),
  ]),
  authController.resendOTP
);

router.post(
  '/login',
  validate([
    body('phone').notEmpty().withMessage('Phone number is required.'),
    body('password').notEmpty().withMessage('Password is required.'),
  ]),
  authController.login
);

router.post(
  '/refresh-token',
  validate([
    body('refreshToken').notEmpty().withMessage('Refresh token is required.'),
  ]),
  authController.refreshToken
);

module.exports = router;
