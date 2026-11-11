function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function monthOf(value) {
  const date = dateValue(value);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : '';
}

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function tripClosedDate(trip) {
  return validDate(trip.turnDate)
    || validDate(trip.dieselEntries?.[trip.dieselEntries.length - 1]?.filledAt)
    || validDate(trip.closedAt)
    || validDate(trip.loadingDate);
}

export function salaryMonthOfTrip(trip) {
  const salaryDate = [
    tripClosedDate(trip),
    validDate(trip.loadingDate),
    validDate(trip.unloadingDate),
    validDate(trip.unTurnDate),
    validDate(trip.turnDate),
  ].filter(Boolean).reduce((latest, date) => (!latest || date > latest ? date : latest), null);
  const isReady = ['pending_close', 'closed'].includes(trip.status) || Boolean(validDate(trip.turnDate));
  return isReady && salaryDate ? monthOf(salaryDate) : '';
}

export function dateKey(value) {
  const date = dateValue(value);
  return date ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) : null;
}

export function orderedTrips(trips) {
  return [...trips].sort((a, b) => {
    const loadingDateDifference = (dateKey(a.loadingDate) ?? Number.MAX_SAFE_INTEGER)
      - (dateKey(b.loadingDate) ?? Number.MAX_SAFE_INTEGER);
    return loadingDateDifference
      || new Date(a.createdAt || a.loadingDate || 0).getTime()
        - new Date(b.createdAt || b.loadingDate || 0).getTime();
  });
}

export function buildTripVerificationIntervals(trips, month, records) {
  const sortedTrips = orderedTrips(trips);
  const statementDates = records.map((record) => dateKey(record.date))
    .filter((date) => date != null);
  const earliestStatementDate = statementDates.length ? Math.min(...statementDates) : null;

  return sortedTrips
    .map((trip, index) => {
      if (salaryMonthOfTrip(trip) !== month) return null;
      const previousTurnDate = index === 0
        ? earliestStatementDate
        : dateKey(sortedTrips[index - 1].turnDate);
      const currentTurnDate = dateKey(trip.turnDate);
      if (previousTurnDate == null || currentTurnDate == null || currentTurnDate < previousTurnDate) return null;
      return { trip, previousTurnDate, currentTurnDate };
    })
    .filter(Boolean);
}
