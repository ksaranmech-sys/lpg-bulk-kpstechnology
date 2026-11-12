function getTripClosedDate(trip) {
  const turnDate = trip.turnDate ? new Date(trip.turnDate) : null;
  if (turnDate && !Number.isNaN(turnDate.getTime())) return turnDate;

  const entries = trip.dieselEntries || [];
  const filledAt = entries[entries.length - 1]?.filledAt ? new Date(entries[entries.length - 1].filledAt) : null;
  if (filledAt && !Number.isNaN(filledAt.getTime())) return filledAt;

  const closedAt = trip.closedAt ? new Date(trip.closedAt) : null;
  if (closedAt && !Number.isNaN(closedAt.getTime())) return closedAt;

  const loadingDate = trip.loadingDate ? new Date(trip.loadingDate) : null;
  return loadingDate && !Number.isNaN(loadingDate.getTime()) ? loadingDate : null;
}

function getTripSalaryDate(trip) {
  const candidates = [
    getTripClosedDate(trip),
    trip.loadingDate,
    trip.unloadingDate,
    trip.unTurnDate,
    trip.turnDate,
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!candidates.length) return null;
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

function isTripWithinDeletionWindow(trip, now = new Date(), windowDays = 45) {
  const salaryDate = getTripSalaryDate(trip);
  const createdDate = trip.createdAt ? new Date(trip.createdAt) : null;
  const date = salaryDate || (
    createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null
  );
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  return Boolean(
    date
    && !Number.isNaN(date.getTime())
    && date.getTime() <= now.getTime()
    && date.getTime() >= cutoff,
  );
}

module.exports = { getTripClosedDate, getTripSalaryDate, isTripWithinDeletionWindow };
