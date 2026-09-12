const jwt = require('jsonwebtoken');
const { ROLES } = require('../config/constants');
const Customer = require('../models/Customer');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.customer && payload.role !== ROLES.SUPER_ADMIN) {
      const customer = await Customer.findOne({ _id: payload.customer, isActive: true }).select('_id');
      if (!customer) return res.status(403).json({ error: 'Customer account is blocked' });
    }
    req.user = payload; // { id, role, customer, vehicle }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }
    next();
  };
}

/**
 * Ensures the authenticated user is allowed to touch the vehicle referenced
 * by req.params.vehicleId (or a vehicleId resolved earlier onto req.vehicleId).
 * - super_admin: always allowed
 * - customer_admin: allowed for any vehicle under their own customer
 * - vehicle_user: allowed only for their single assigned vehicle
 *
 * Route handlers still filter DB queries by customer/vehicle scope - this is
 * a defense-in-depth check, not the only check.
 */
function scopeToVehicle(getVehicleCustomerAndId) {
  return async (req, res, next) => {
    try {
      const vehicleId = req.params.vehicleId || req.body.vehicle || req.vehicleId;
      if (!vehicleId) return res.status(400).json({ error: 'vehicleId is required' });

      if (req.user.role === ROLES.SUPER_ADMIN) return next();

      if (req.user.role === ROLES.VEHICLE_USER) {
        if (String(req.user.vehicle) !== String(vehicleId)) {
          return res.status(403).json({ error: 'Access restricted to your assigned vehicle' });
        }
        return next();
      }

      // customer_admin: vehicle must belong to their customer
      const { customerId } = await getVehicleCustomerAndId(vehicleId);
      if (String(customerId) !== String(req.user.customer)) {
        return res.status(403).json({ error: 'Vehicle does not belong to your account' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, requireRole, scopeToVehicle };
