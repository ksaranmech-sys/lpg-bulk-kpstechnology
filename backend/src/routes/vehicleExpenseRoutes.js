const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehicleExpenseController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rules } = require('../middleware/validate');
const { ROLES } = require('../config/constants');

// Vehicle running costs are an admin-only concern; the controller scopes customer_admin to their own customer.
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN));

router.get('/', ctrl.listVehicleExpenses);
router.post('/', rules.createVehicleExpense, ctrl.createVehicleExpense);
router.patch('/:expenseId', rules.updateVehicleExpense, ctrl.updateVehicleExpense);
router.delete('/:expenseId', rules.expenseId, ctrl.deleteVehicleExpense);

module.exports = router;
