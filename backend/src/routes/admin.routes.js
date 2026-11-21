const { Router } = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const adminController = require('../controllers/admin.controller');

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

// Reports
router.get('/reports/appointments', adminController.getAppointmentReport);
router.get('/reports/no-shows', adminController.getNoShowReport);
router.get('/reports/clinic-load', adminController.getClinicLoad);

// Block dates
router.post(
  '/block-date',
  validate([
    body('clinic_id').notEmpty(),
    body('date').isDate(),
    body('reason').optional().trim(),
  ]),
  adminController.blockDate
);
router.delete('/block-date/:clinicId/:date', adminController.unblockDate);

// Cancel session
router.post(
  '/cancel-session',
  validate([
    body('clinic_id').notEmpty(),
    body('date').isDate(),
    body('reason').trim().notEmpty().withMessage('Reason is required.'),
  ]),
  adminController.cancelSession
);

// Staff management
router.get('/staff', adminController.listStaff);
router.post(
  '/staff',
  validate([
    body('name').trim().notEmpty(),
    body('role').isIn(['front_desk', 'midwife', 'doctor', 'admin']),
    body('phone').notEmpty(),
    body('password').isLength({ min: 6 }),
  ]),
  adminController.createStaff
);
router.put('/staff/:id', adminController.updateStaff);

module.exports = router;
