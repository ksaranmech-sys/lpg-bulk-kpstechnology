const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/leaveController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(requireAuth);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN, ROLES.VEHICLE_USER), ctrl.listLeaves);
router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN, ROLES.VEHICLE_USER), ctrl.createLeave);
router.patch('/:leaveId', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN, ROLES.VEHICLE_USER), ctrl.updateLeave);
router.delete('/:leaveId', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN, ROLES.VEHICLE_USER), ctrl.deleteLeave);

module.exports = router;
