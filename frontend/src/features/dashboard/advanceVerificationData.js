import {
  buildTripVerificationIntervals,
  dateKey,
  salaryMonthOfTrip,
} from './tripVerificationIntervals';

function normalizeVehicleNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

function normalizeMobileNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function recordsForVehicle(uploads, vehicleNumber, driverMobileNumber) {
  const targetVehicleNumber = normalizeVehicleNumber(vehicleNumber);
  const targetMobileNumber = normalizeMobileNumber(driverMobileNumber);
  return uploads.flatMap((upload) => (upload.advanceRecords || [])
    .filter((record) => {
      const recordVehicleNumber = normalizeVehicleNumber(
        record.vehicleNumber || (!record.driverMobileNumber ? upload.defaultVehicleNumber : '')
      );
      const recordMobileNumber = normalizeMobileNumber(record.driverMobileNumber);
      return (!recordVehicleNumber && !recordMobileNumber)
        || (targetVehicleNumber && recordVehicleNumber === targetVehicleNumber)
        || (targetMobileNumber && recordMobileNumber === targetMobileNumber);
    }));
}

export function getAdvanceVerificationDateRange(
  trips,
  month,
  uploads = [],
  vehicleNumber = '',
  driverMobileNumber = ''
) {
  const records = recordsForVehicle(uploads, vehicleNumber, driverMobileNumber);
  const intervals = buildTripVerificationIntervals(trips, month, records);
  if (!intervals.length) return null;
  const fromDate = Math.min(...intervals.map((interval) => interval.previousTurnDate));
  const toDate = Math.max(...intervals.map((interval) => interval.currentTurnDate));
  return {
    fromDate: new Date(fromDate).toISOString().slice(0, 10),
    toDate: new Date(toDate).toISOString().slice(0, 10),
  };
}

export function buildAdvanceVerificationRows(
  trips,
  month,
  uploads,
  vehicleNumber = '',
  driverMobileNumber = ''
) {
  const records = recordsForVehicle(uploads, vehicleNumber, driverMobileNumber);
  const intervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, records).map((interval) => [interval.trip._id, interval])
  );
  const countedStatementRecords = new Set();

  return trips
    .filter((trip) => salaryMonthOfTrip(trip) === month)
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
            || countedStatementRecords.has(record)
          ) return false;
          return true;
        })
        : [];
      matchingRecords.forEach((record) => countedStatementRecords.add(record));

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
