const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const clinicController = require('../controllers/clinic.controller');

const router = Router();

// Public: list clinics and check availability
router.get('/', clinicController.listClinics);
router.get('/:id', clinicController.getClinic);
router.get('/:id/slots', clinicController.getAvailableSlots);

// Admin only
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validate([
    body('name').trim().notEmpty().withMessage('Clinic name is required.'),
    body('slot_duration_min').optional().isInt({ min: 5, max: 120 }),
    body('walkin_reserve_pct').optional().isFloat({ min: 0, max: 1 }),
  ]),
  clinicController.createClinic
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validate([
    body('name').optional().trim().notEmpty(),
    body('slot_duration_min').optional().isInt({ min: 5, max: 120 }),
    body('walkin_reserve_pct').optional().isFloat({ min: 0, max: 1 }),
  ]),
  clinicController.updateClinic
);

module.exports = router;
