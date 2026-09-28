const Trip = require('../models/Trip');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

async function scopeToTrip(req, res, next) {
  const trip = await getTripOr404(req, res);
  if (!trip) return;

  if (hasAdministrativeTripAccess(req, trip)) return next();
  if (
    req.user.role === ROLES.VEHICLE_USER &&
    String(trip.vehicle) === String(req.user.vehicle)
  ) return next();

  return res.status(403).json({ error: 'Not allowed to access this trip' });
}

// Trip entries are edited only by the assigned driver (while the trip is open) or a super admin.
// Customer admins can view, close and delete trips but never change the details themselves.
async function scopeToOpenTripForUser(req, res, next) {
  const trip = await getTripOr404(req, res);
  if (!trip) return;

  if (req.user.role === ROLES.SUPER_ADMIN) return next();
  if (req.user.role === ROLES.CUSTOMER_ADMIN) {
    return res.status(403).json({ error: 'Customer admins cannot edit trip details' });
  }

  const currentUser = req.user.role === ROLES.VEHICLE_USER
    ? await User.findById(req.user.id).select('role vehicle isActive')
    : null;
  const assignedVehicle = currentUser?.vehicle || req.user.vehicle;
  if (
    req.user.role === ROLES.VEHICLE_USER &&
    currentUser?.role === ROLES.VEHICLE_USER &&
    currentUser.isActive &&
    String(trip.vehicle) === String(assignedVehicle)
  ) {
    return next();
  }

  return res.status(403).json({ error: 'Only the assigned user can edit this trip' });
}

async function scopeToTripClose(req, res, next) {
  const trip = await getTripOr404(req, res);
  if (!trip) return;

  if (hasAdministrativeTripAccess(req, trip) && ['open', 'pending_close'].includes(trip.status)) return next();
  if (trip.status !== 'open') {
    return res.status(400).json({ error: 'Trip is already awaiting or has completed customer close' });
  }

  const currentUser = req.user.role === ROLES.VEHICLE_USER
    ? await User.findById(req.user.id).select('role vehicle isActive')
    : null;
  const assignedVehicle = currentUser?.vehicle || req.user.vehicle;
  if (
    req.user.role === ROLES.VEHICLE_USER &&
    currentUser?.role === ROLES.VEHICLE_USER &&
    currentUser.isActive &&
    String(trip.vehicle) === String(assignedVehicle)
  ) return next();

  return res.status(403).json({ error: 'Only the assigned user or customer can close this trip' });
}

async function getTripOr404(req, res) {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return null;
  }
  return trip;
}

function hasAdministrativeTripAccess(req, trip) {
  return req.user.role === ROLES.SUPER_ADMIN || (
    req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)
  );
}

module.exports = { scopeToTrip, scopeToOpenTripForUser, scopeToTripClose };