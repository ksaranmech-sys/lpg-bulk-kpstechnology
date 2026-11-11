import {
  buildTripVerificationIntervals,
  dateKey,
  orderedTrips,
  previousLoadTurnDates,
  salaryMonthOfTrip,
} from './tripVerificationIntervals';

function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function normalizeVehicleNumber(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function recordsForVehicle(uploads, vehicleNumber, recordType = 'dieselRecords') {
  const targetVehicleNumber = normalizeVehicleNumber(vehicleNumber);
  return uploads.flatMap((upload) => (upload[recordType] || [])
    .filter((record) => !targetVehicleNumber
      || normalizeVehicleNumber(record.vehicleNumber || upload.defaultVehicleNumber) === targetVehicleNumber));
}

export function getDieselVerificationDateRange(trips, month, uploads = [], vehicleNumber = '') {
  const dieselRecords = recordsForVehicle(uploads, vehicleNumber);
  const defRecords = recordsForVehicle(uploads, vehicleNumber, 'defRecords');
  const defAmountRecords = recordsForVehicle(uploads, vehicleNumber, 'defAmountRecords');
  const intervals = buildTripVerificationIntervals(
    trips,
    month,
    [...dieselRecords, ...defRecords, ...defAmountRecords]
  );
  if (!intervals.length) return null;
  const fromDate = Math.min(...intervals.map((interval) => interval.previousTurnDate));
  const toDate = Math.max(...intervals.map((interval) => interval.lastIncludedDate));
  return {
    fromDate: new Date(fromDate).toISOString().slice(0, 10),
    toDate: new Date(toDate).toISOString().slice(0, 10),
  };
}

export function buildDieselVerificationRows(trips, month, uploads, vehicleNumber = '') {
  const dieselRecords = recordsForVehicle(uploads, vehicleNumber);
  const defAmountRecords = recordsForVehicle(uploads, vehicleNumber, 'defAmountRecords');
  const intervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, dieselRecords).map((interval) => [interval.trip._id, interval])
  );
  const defAmountIntervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, defAmountRecords)
      .map((interval) => [interval.trip._id, interval])
  );
  const ordered = orderedTrips(trips);
  const previousTurnDatesByTrip = previousLoadTurnDates(trips);
  const countedStatementDates = new Set();
  const countedDefAmountStatementDates = new Set();

  return ordered
    .filter((trip) => salaryMonthOfTrip(trip) === month)
    .map((trip) => {
      const interval = intervalsByTrip.get(trip._id);
      const matchingRecords = interval
        ? dieselRecords.filter((record) => {
          const recordDate = dateKey(record.date);
          if (
            recordDate == null
            || recordDate < interval.previousTurnDate
            || recordDate > interval.lastIncludedDate
            || countedStatementDates.has(recordDate)
          ) return false;
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
      const defAmountInterval = defAmountIntervalsByTrip.get(trip._id);
      const matchingDefAmountRecords = defAmountInterval
        ? defAmountRecords.filter((record) => {
          const recordDate = dateKey(record.date);
          if (
            recordDate == null
            || recordDate < defAmountInterval.previousTurnDate
            || recordDate > defAmountInterval.lastIncludedDate
            || countedDefAmountStatementDates.has(recordDate)
          ) return false;
          return true;
        })
        : [];
      matchingDefAmountRecords.forEach((record) => (
        countedDefAmountStatementDates.add(dateKey(record.date))
      ));
      const defAmountFromDocument = matchingDefAmountRecords.length
        ? matchingDefAmountRecords.reduce((sum, record) => sum + (Number(record.amount) || 0), 0)
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
        previousLoadTurnDate: previousTurnDatesByTrip.get(trip._id),
        loading: trip.loadingLocation || '',
        loadingWeightTons: trip.loadingWeightTons ?? null,
        unloading: trip.unloadingLocation || '',
        unloadingDate: trip.unloadingDate || null,
        tripKm: trip.settlement?.totalKm ?? null,
        mileageKmPerLitre: trip.settlement?.mileageKmPerLitre ?? null,
        dieselForTrip: trip.settlement?.totalDieselLitres ?? null,
        tripDiesel: dieselAdded,
        dieselFromDocument,
        defAmountFromDocument,
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

export function formatVerificationAmount(value) {
  return value == null
    ? '—'
    : `₹${Number(value).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
}

export function formatVerificationKilometres(value) {
  return value == null
    ? '—'
    : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} km`;
}

export function formatVerificationMileage(value) {
  return value == null
    ? '—'
    : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} km/L`;
}
