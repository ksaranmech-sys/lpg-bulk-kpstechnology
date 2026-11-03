function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function monthOf(value) {
  const date = dateValue(value);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : '';
}

function dateKey(value) {
  const date = dateValue(value);
  return date ? Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) : null;
}

function orderedTrips(trips) {
  return [...trips].sort((a, b) => {
    const loadingDateDifference = (dateKey(a.loadingDate) ?? Number.MAX_SAFE_INTEGER)
      - (dateKey(b.loadingDate) ?? Number.MAX_SAFE_INTEGER);
    return loadingDateDifference
      || new Date(a.createdAt || a.loadingDate || 0).getTime()
        - new Date(b.createdAt || b.loadingDate || 0).getTime();
  });
}

function tripDocumentIntervals(trips, month, dieselRecords = []) {
  const sortedTrips = orderedTrips(trips);
  const statementDates = dieselRecords.map((record) => dateKey(record.date))
    .filter((date) => date != null);
  const earliestStatementDate = statementDates.length ? Math.min(...statementDates) : null;
  return sortedTrips
    .map((trip, index) => {
      if (monthOf(trip.loadingDate) !== month) return null;
      const previousTurnDate = index === 0
        ? earliestStatementDate
        : dateKey(sortedTrips[index - 1].turnDate);
      const currentTurnDate = dateKey(trip.turnDate);
      if (previousTurnDate == null || currentTurnDate == null || currentTurnDate < previousTurnDate) return null;
      return { trip, previousTurnDate, currentTurnDate };
    })
    .filter(Boolean);
}

export function getDieselVerificationDateRange(trips, month, uploads = []) {
  const dieselRecords = uploads.flatMap((upload) => upload.dieselRecords || []);
  const intervals = tripDocumentIntervals(trips, month, dieselRecords);
  if (!intervals.length) return null;
  const fromDate = Math.min(...intervals.map((interval) => interval.previousTurnDate));
  const toDate = Math.max(...intervals.map((interval) => interval.currentTurnDate));
  return {
    fromDate: new Date(fromDate).toISOString().slice(0, 10),
    toDate: new Date(toDate).toISOString().slice(0, 10),
  };
}

export function buildDieselVerificationRows(trips, month, uploads) {
  const dieselRecords = uploads.flatMap((upload) => upload.dieselRecords || []);
  const intervalsByTrip = new Map(
    tripDocumentIntervals(trips, month, dieselRecords).map((interval) => [interval.trip._id, interval])
  );
  const countedStatementDates = new Set();
  const countedStatementTransactions = new Set();

  return trips
    .filter((trip) => monthOf(trip.loadingDate) === month)
    .sort((a, b) => (
      dateKey(a.loadingDate) - dateKey(b.loadingDate)
      || new Date(a.createdAt || a.loadingDate || 0).getTime()
        - new Date(b.createdAt || b.loadingDate || 0).getTime()
    ))
    .map((trip) => {
      const interval = intervalsByTrip.get(trip._id);
      const matchingRecords = interval
        ? dieselRecords.filter((record) => {
          const recordDate = dateKey(record.date);
          const transactionKey = recordDate == null
            ? ''
            : `${recordDate}:${Number(record.litres)}`;
          if (
            recordDate == null
            || recordDate < interval.previousTurnDate
            || recordDate > interval.currentTurnDate
            || countedStatementDates.has(recordDate)
            || countedStatementTransactions.has(transactionKey)
          ) return false;
          countedStatementTransactions.add(transactionKey);
          return true;
        })
        : [];
      matchingRecords.forEach((record) => {
        const recordDate = dateKey(record.date);
        countedStatementDates.add(recordDate);
      });
      const dieselFromDocument = matchingRecords.length
        ? matchingRecords.reduce((sum, record) => sum + (Number(record.litres) || 0), 0)
        : null;
      const dieselEntries = Array.isArray(trip.dieselEntries) ? trip.dieselEntries : [];
      const dieselAdded = dieselEntries.length
        ? dieselEntries.reduce((sum, entry) => {
          const litres = Number(entry.volumeLitres);
          return Number.isFinite(litres) ? sum + litres : sum;
        }, 0)
        : null;

      return {
        id: trip._id,
        loading: trip.loadingLocation || '',
        loadingWeightTons: trip.loadingWeightTons ?? null,
        unloading: trip.unloadingLocation || '',
        unloadingDate: trip.unloadingDate || null,
        tripDiesel: dieselAdded,
        dieselFromDocument,
      };
    });
}

export function formatVerificationDate(value) {
  const date = dateValue(value);
  return date ? date.toLocaleDateString('en-IN', { timeZone: 'UTC' }) : '—';
}

export function formatVerificationLitres(value) {
  return value == null
    ? '—'
    : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} L`;
}
