const { ROLES } = require('../config/constants');
const Customer = require('../models/Customer');
const { PDF_TOKEN_SCOPE, verifyAccessToken, signPdfToken } = require('../utils/tokens');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const queryToken = !bearerToken && typeof req.query.token === 'string' ? req.query.token : null;
  if (!bearerToken && !queryToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  try {
    const payload = verifyAccessToken(bearerToken || queryToken);
    // Scoped tokens are short-lived grants for opening a PDF directly in a browser tab (where
    // no Authorization header can be sent). They're only valid for that one GET resource.
    const isScoped = Boolean(payload.scope);
    const requestPath = req.originalUrl.split('?')[0];
    if (isScoped && (!queryToken || req.method !== 'GET' || payload.scope !== PDF_TOKEN_SCOPE || !requestPath.endsWith(`/${PDF_TOKEN_SCOPE}`))) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (queryToken && !isScoped) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
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

module.exports = { requireAuth, requireRole, scopeToVehicle, signPdfToken };
