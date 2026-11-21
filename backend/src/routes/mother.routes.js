const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const motherController = require('../controllers/mother.controller');

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/profile', motherController.getProfile);

router.put(
  '/profile',
  validate([
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty.'),
    body('hospital_id').optional().trim(),
    body('hmo_number').optional().trim(),
  ]),
  motherController.updateProfile
);

// Staff-only: search mothers by name or phone (must be before /:id)
router.get(
  '/search',
  authorize('front_desk', 'admin'),
  motherController.searchMothers
);

// Staff-only: register a mother at front desk
router.post(
  '/',
  authorize('front_desk', 'admin'),
  validate([
    body('name').trim().notEmpty().withMessage('Mother name is required.'),
    body('phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('hospital_id').optional({ nullable: true }).trim().isLength({ max: 50 }).withMessage('Hospital ID must not exceed 50 characters.'),
    body('hmo_number').optional({ nullable: true }).trim().isLength({ max: 50 }).withMessage('HMO number must not exceed 50 characters.'),
  ]),
  motherController.registerMotherByStaff
);

// Staff-only: get a mother by ID
router.get(
  '/:id',
  authorize('admin', 'front_desk', 'midwife', 'doctor'),
  motherController.getMotherById
);

module.exports = router;
