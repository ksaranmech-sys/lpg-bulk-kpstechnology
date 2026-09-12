const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/customerController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.use(requireAuth);

// A customer_admin may only manage their own customer record.
function ownCustomerOnly(req, res, next) {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  const userCustomerId = req.user.customer && typeof req.user.customer === 'object'
    ? (req.user.customer._id || req.user.customer.toString())
    : req.user.customer;

  if (req.user.role === ROLES.CUSTOMER_ADMIN && String(userCustomerId) === String(req.params.customerId)) {
    return next();
  }
  return res.status(403).json({ error: 'Not allowed for this customer' });
}

// Only KPS staff onboard new customers
router.post('/', requireRole(ROLES.SUPER_ADMIN), ctrl.createCustomer);
router.get('/', requireRole(ROLES.SUPER_ADMIN), ctrl.listCustomers);
router.get('/:customerId', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), ownCustomerOnly, ctrl.getCustomer);
router.get('/:customerId/users/:userId/salary', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), ownCustomerOnly, ctrl.getDriverMonthlySalary);
router.get('/:customerId/users/:userId/monthly-summary', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), ownCustomerOnly, ctrl.downloadDriverMonthlySummary);
router.patch('/:customerId', requireRole(ROLES.SUPER_ADMIN), ctrl.updateCustomer);
router.patch('/:customerId/status', requireRole(ROLES.SUPER_ADMIN), ctrl.setCustomerStatus);
router.delete('/:customerId', requireRole(ROLES.SUPER_ADMIN), ctrl.deleteCustomer);

// Customer admin (or super_admin) manages their own vehicles/users
router.post('/:customerId/vehicles', requireRole(ROLES.SUPER_ADMIN, ROLES.CUSTOMER_ADMIN), ownCustomerOnly, ctrl.addVehicle);
router.post(
  '/:customerId/users',
  requireRole(ROLES.CUSTOMER_ADMIN),
  ownCustomerOnly,
  ctrl.createVehicleUser
);
router.patch(
  '/:customerId/users/bulk',
  requireRole(ROLES.CUSTOMER_ADMIN),
  ownCustomerOnly,
  ctrl.bulkUpdateVehicleUsers
);
router.delete(
  '/:customerId/users/bulk',
  requireRole(ROLES.CUSTOMER_ADMIN),
  ownCustomerOnly,
  ctrl.bulkDeleteVehicleUsers
);
router.patch(
  '/:customerId/users/:userId',
  requireRole(ROLES.CUSTOMER_ADMIN),
  ownCustomerOnly,
  ctrl.updateVehicleUser
);
router.delete(
  '/:customerId/users/:userId',
  requireRole(ROLES.CUSTOMER_ADMIN),
  ownCustomerOnly,
  ctrl.deleteVehicleUser
);

module.exports = router;
