const Trip = require('../models/Trip');
const { TRIP_STATUS } = require('../config/constants');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getTripRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - ONE_YEAR_MS);
}

async function removeExpiredClosedTrips(now = new Date()) {
  const cutoff = getTripRetentionCutoff(now);
  const result = await Trip.deleteMany({
    status: TRIP_STATUS.CLOSED,
    createdAt: { $lt: cutoff },
  });
  return result.deletedCount || 0;
}

module.exports = { getTripRetentionCutoff, removeExpiredClosedTrips };
