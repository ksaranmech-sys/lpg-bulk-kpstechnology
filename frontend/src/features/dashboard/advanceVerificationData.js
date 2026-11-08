import {
  buildTripVerificationIntervals,
  dateKey,
  monthOf,
} from './tripVerificationIntervals';

function normalizeVehicleNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

function recordsForVehicle(uploads, vehicleNumber) {
  const targetVehicleNumber = normalizeVehicleNumber(vehicleNumber);
  return uploads.flatMap((upload) => (upload.advanceRecords || [])
    .filter((record) => !targetVehicleNumber
      || normalizeVehicleNumber(record.vehicleNumber || upload.defaultVehicleNumber) === targetVehicleNumber));
}

export function getAdvanceVerificationDateRange(trips, month, uploads = [], vehicleNumber = '') {
  const records = recordsForVehicle(uploads, vehicleNumber);
  const intervals = buildTripVerificationIntervals(trips, month, records);
  if (!intervals.length) return null;
  const fromDate = Math.min(...intervals.map((interval) => interval.previousTurnDate));
  const toDate = Math.max(...intervals.map((interval) => interval.currentTurnDate));
  return {
    fromDate: new Date(fromDate).toISOString().slice(0, 10),
    toDate: new Date(toDate).toISOString().slice(0, 10),
  };
}

export function buildAdvanceVerificationRows(trips, month, uploads, vehicleNumber = '') {
  const records = recordsForVehicle(uploads, vehicleNumber);
  const intervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, records).map((interval) => [interval.trip._id, interval])
  );
  const countedStatementDates = new Set();

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
        ? records.filter((record) => {
          const recordDate = dateKey(record.date);
          if (
            recordDate == null
            || recordDate < interval.previousTurnDate
            || recordDate > interval.currentTurnDate
            || countedStatementDates.has(recordDate)
          ) return false;
          return true;
        })
        : [];
      matchingRecords.forEach((record) => countedStatementDates.add(dateKey(record.date)));

      const advances = Array.isArray(trip.driverAdvances) ? trip.driverAdvances : [];
      const advancesAdded = advances.length
        ? advances.reduce((sum, advance) => {
          const amount = Number(advance.amount);
          return Number.isFinite(amount) ? sum + amount : sum;
        }, 0)
        : null;
      const advanceFromDocument = matchingRecords.length
        ? matchingRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)
        : interval ? 0 : null;

      return {
        id: trip._id,
        loading: trip.loadingLocation || '',
        unloading: trip.unloadingLocation || '',
        unloadingDate: trip.unloadingDate || null,
        advancesAdded,
        advanceFromDocument,
      };
    });
}

export function formatVerificationAmount(value) {
  return value == null
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
