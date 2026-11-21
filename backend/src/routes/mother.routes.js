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

// Staff-only: get a mother by ID
router.get(
  '/:id',
  authorize('admin', 'front_desk', 'midwife', 'doctor'),
  motherController.getMotherById
);

module.exports = router;
