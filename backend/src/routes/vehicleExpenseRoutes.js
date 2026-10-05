const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vehicleExpenseController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rules } = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const { ROLES } = require('../config/constants');

// Vehicle running costs are an admin-only concern; the controller scopes customer_admin to their own customer.
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN));

router.get('/', ctrl.listVehicleExpenses);
// multipart/form-data with an optional `photo` (receipt); plain JSON bodies still work.
router.post('/', upload.single('photo'), rules.createVehicleExpense, ctrl.createVehicleExpense);
router.patch('/:expenseId', upload.single('photo'), rules.updateVehicleExpense, ctrl.updateVehicleExpense);
router.delete('/:expenseId', rules.expenseId, ctrl.deleteVehicleExpense);

module.exports = router;
