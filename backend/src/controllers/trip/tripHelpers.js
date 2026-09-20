// Shared trip helpers: entry-date validation, close-date resolution, access checks, settlement refresh.
const Trip = require('../../models/Trip');
const User = require('../../models/User');
const { computeTripSettlement } = require('../../utils/tripCalculations');
const { TRIP_STATUS, ROLES } = require('../../config/constants');

function getClosingDieselDate(trip, fallback = null) {
  const closingEntry = trip.dieselEntries?.[trip.dieselEntries.length - 1];
  const filledAt = closingEntry?.filledAt ? new Date(closingEntry.filledAt) : null;
  return filledAt && !Number.isNaN(filledAt.getTime()) ? filledAt : fallback;
}

function getTripCloseDate(trip) {
  const turnDate = trip.turnDate ? new Date(trip.turnDate) : null;
  if (turnDate && !Number.isNaN(turnDate.getTime())) return turnDate;
  return getClosingDieselDate(trip);
}

// Advance/Diesel/RTO/Other Expense entries can be backdated freely (late entries are allowed)
// but can't predate whichever is later: the currently assigned driver's joining date, or the
// previous trip's Load Turn (close) date. A trip counts as "closed" here as soon as the driver
// presses Trip Close (status moves to pending_close or closed) - the settlement math finishing
// in the background afterwards doesn't change that boundary. Entries also can't be dated after
// this trip's own close date - if that isn't set yet, they also can't be dated in the future.
async function getDriverJoiningDate(trip) {
  const driver = await User.findOne({ role: ROLES.VEHICLE_USER, vehicle: trip.vehicle }).select('joiningDate');
  return driver?.joiningDate ? new Date(driver.joiningDate) : null;
}

async function getPreviousTripCloseDate(trip) {
  const previousTrip = await Trip.findOne({
    vehicle: trip.vehicle,
    createdAt: { $lt: trip.createdAt },
    status: { $in: [TRIP_STATUS.PENDING_CLOSE, TRIP_STATUS.CLOSED] },
  }).sort('-createdAt');
  return previousTrip?.turnDate ? new Date(previousTrip.turnDate) : null;
}

async function getEntryFloorDate(trip) {
  const [driverJoiningDate, previousTripCloseDate] = await Promise.all([
    getDriverJoiningDate(trip),
    getPreviousTripCloseDate(trip),
  ]);
  if (driverJoiningDate && previousTripCloseDate) {
    return driverJoiningDate > previousTripCloseDate ? driverJoiningDate : previousTripCloseDate;
  }
  return driverJoiningDate || previousTripCloseDate || null;
}

async function validateEntryDate(trip, date, label) {
  const floor = await getEntryFloorDate(trip);
  if (floor && date < floor) {
    return `${label} date cannot be before the driver's joining date or the previous trip's close date.`;
  }
  const upperBound = trip.turnDate || new Date();
  if (date > upperBound) {
    return trip.turnDate
      ? `${label} date must be on or before this trip's Load Turn (close) date.`
      : `${label} date cannot be in the future.`;
  }
  return null;
}

// Loading/unloading location + date are compulsory before a trip can close.
const REQUIRED_CLOSE_FIELDS = [
  ['loadingLocation', 'loading location'],
  ['loadingDate', 'loading date'],
  ['unloadingLocation', 'unloading location'],
  ['unloadingDate', 'unloading date'],
];

function getMissingTripRouteFields(trip) {
  return REQUIRED_CLOSE_FIELDS
    .filter(([field]) => {
      const value = trip?.[field];
      if (typeof value === 'string') return value.trim() === '';
      return value == null;
    })
    .map(([, label]) => label);
}

function hasValidGpsCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

/**
 * Shared logic: whenever a new trip's first diesel entry is saved, look up
 * the vehicle's previous OPEN trip and attempt to compute + finalize its
 * settlement now that we have the "next trip first fill" data point we need.
 */
async function tryCloseVehiclePreviousTrip(newTrip) {
  const previousTrip = await Trip.findOne({
    vehicle: newTrip.vehicle,
    status: { $in: [TRIP_STATUS.OPEN, TRIP_STATUS.PENDING_CLOSE] },
    _id: { $ne: newTrip._id },
  }).sort('-createdAt');

  if (!previousTrip) return; // this is the very first trip ever for the vehicle

  // Never auto-close a trip whose route details are incomplete - leave it
  // open so someone can fill in loading/unloading info and close it manually.
  if (getMissingTripRouteFields(previousTrip).length > 0) return;

  const result = computeTripSettlement(previousTrip, newTrip);
  if (!result.ready) return; // not enough data yet - leave open

  previousTrip.settlement = result.settlement;
  previousTrip.status = TRIP_STATUS.CLOSED;
  previousTrip.closedAt = getClosingDieselDate(newTrip);
  previousTrip.nextTrip = newTrip._id;
  await previousTrip.save();
}

async function refreshRelatedSettlements(trip) {
  if (trip.status !== TRIP_STATUS.CLOSED) {
    const previousClosedTrip = await Trip.findOne({
      vehicle: trip.vehicle,
      status: TRIP_STATUS.CLOSED,
      createdAt: { $lt: trip.createdAt },
    }).sort('-createdAt');
    if (previousClosedTrip && String(previousClosedTrip.nextTrip || '') === String(trip._id)) {
      await refreshTripSettlement(previousClosedTrip);
    }
    return;
  }
  await refreshTripSettlement(trip);
}

async function refreshTripSettlement(trip) {
  const nextTrip = await Trip.findOne({
    vehicle: trip.vehicle,
    _id: { $ne: trip._id },
    createdAt: { $gt: trip.createdAt },
  }).sort({ createdAt: 1 });
  const result = computeTripSettlement(trip, nextTrip);
  if (!result.ready) return;
  trip.settlement = result.settlement;
  trip.nextTrip = nextTrip?._id || trip.nextTrip;
  await trip.save();
}

async function getOpenTripOr404(req, res) {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return null;
  }

  if (req.user.role === ROLES.SUPER_ADMIN) return trip;
  if (req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)) return trip;

  const currentUser = req.user.role === ROLES.VEHICLE_USER
    ? await User.findById(req.user.id).select('role vehicle isActive')
    : null;
  const assignedVehicle = currentUser?.vehicle || req.user.vehicle;
  if (
    req.user.role !== ROLES.VEHICLE_USER ||
    currentUser?.role !== ROLES.VEHICLE_USER ||
    !currentUser.isActive ||
    String(trip.vehicle) !== String(assignedVehicle)
  ) {
    res.status(403).json({ error: 'Only the assigned user can edit an open trip' });
    return null;
  }
  // Once the driver has pressed Trip Close, the trip is locked from further driver edits -
  // only customer admins / super admins can still adjust it from here.
  if (trip.status !== TRIP_STATUS.OPEN) {
    res.status(403).json({ error: 'This trip is already closed and can no longer be edited.' });
    return null;
  }
  return trip;
}

module.exports = {
  getClosingDieselDate,
  getTripCloseDate,
  getDriverJoiningDate,
  getPreviousTripCloseDate,
  getEntryFloorDate,
  validateEntryDate,
  getMissingTripRouteFields,
  hasValidGpsCoordinates,
  tryCloseVehiclePreviousTrip,
  refreshRelatedSettlements,
  refreshTripSettlement,
  getOpenTripOr404,
};
