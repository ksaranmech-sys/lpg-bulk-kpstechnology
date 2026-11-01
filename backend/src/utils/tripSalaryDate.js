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

module.exports = { getTripClosedDate, getTripSalaryDate };
