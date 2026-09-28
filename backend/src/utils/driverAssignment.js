// A vehicle has at most one driver on any given date: each driver's assignment window is
// [joiningDate, resigningDate] (either end open when unset), and windows on the same vehicle
// must not overlap. Older drivers stay on record (isActive) so their history/salary remains.
const User = require('../models/User');
const { ROLES } = require('../config/constants');

function startOfDay(value) {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDriverAssignedOn(driver, date = new Date()) {
  const day = startOfDay(date);
  if (driver.joiningDate && startOfDay(driver.joiningDate) > day) return false;
  if (driver.resigningDate && startOfDay(driver.resigningDate) < day) return false;
  return true;
}

// The driver covering `date` (default today); falls back to the most recently joined driver so
// a vehicle whose only driver has resigned still resolves to someone.
function pickCurrentDriver(drivers, date = new Date()) {
  const list = (drivers || []).filter((driver) => driver && driver.isActive !== false);
  if (!list.length) return null;
  const current = list.filter((driver) => isDriverAssignedOn(driver, date));
  if (current.length) {
    return current.sort((a, b) => new Date(b.joiningDate || 0) - new Date(a.joiningDate || 0))[0];
  }
  return [...list].sort((a, b) => new Date(b.joiningDate || 0) - new Date(a.joiningDate || 0))[0];
}

async function findCurrentDriverForVehicle(vehicleId, date = new Date(), select) {
  const query = User.find({ role: ROLES.VEHICLE_USER, vehicle: vehicleId, isActive: true });
  if (select) query.select(`${select} joiningDate resigningDate isActive`);
  return pickCurrentDriver(await query, date);
}

function windowsOverlap(aStart, aEnd, bStart, bEnd) {
  const startsBeforeOtherEnds = (start, end) => !start || !end || startOfDay(start) <= startOfDay(end);
  return startsBeforeOtherEnds(aStart, bEnd) && startsBeforeOtherEnds(bStart, aEnd);
}

// Another active driver on the same vehicle whose window overlaps [joiningDate, resigningDate].
async function findAssignmentConflict({ customerId, vehicleId, joiningDate, resigningDate, excludeUserId }) {
  const others = await User.find({
    customer: customerId,
    role: ROLES.VEHICLE_USER,
    vehicle: vehicleId,
    isActive: true,
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  }).select('name username joiningDate resigningDate');
  return others.find((other) => windowsOverlap(joiningDate, resigningDate, other.joiningDate, other.resigningDate)) || null;
}

function formatConflictError(conflict, vehicleNumber) {
  const name = conflict.name || conflict.username || 'another driver';
  const from = conflict.joiningDate ? new Date(conflict.joiningDate).toLocaleDateString('en-IN') : 'start';
  const to = conflict.resigningDate ? new Date(conflict.resigningDate).toLocaleDateString('en-IN') : 'ongoing';
  return `Vehicle ${vehicleNumber || ''} already has ${name} assigned (${from} - ${to}). Only one driver can be assigned to a vehicle for a given date - set that driver's resigning date first.`.replace(/\s+/g, ' ').trim();
}

module.exports = {
  isDriverAssignedOn,
  pickCurrentDriver,
  findCurrentDriverForVehicle,
  findAssignmentConflict,
  formatConflictError,
  windowsOverlap,
};
