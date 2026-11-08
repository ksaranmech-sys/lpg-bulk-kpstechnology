import {
  buildTripVerificationIntervals,
  dateKey,
  monthOf,
  orderedTrips,
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
  const intervals = buildTripVerificationIntervals(trips, month, [...dieselRecords, ...defRecords]);
  if (!intervals.length) return null;
  const fromDate = Math.min(...intervals.map((interval) => interval.previousTurnDate));
  const toDate = Math.max(...intervals.map((interval) => interval.currentTurnDate));
  return {
    fromDate: new Date(fromDate).toISOString().slice(0, 10),
    toDate: new Date(toDate).toISOString().slice(0, 10),
  };
}

export function buildDieselVerificationRows(trips, month, uploads, vehicleNumber = '') {
  const dieselRecords = recordsForVehicle(uploads, vehicleNumber);
  const defRecords = recordsForVehicle(uploads, vehicleNumber, 'defRecords');
  const intervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, dieselRecords).map((interval) => [interval.trip._id, interval])
  );
  const defIntervalsByTrip = new Map(
    buildTripVerificationIntervals(trips, month, defRecords).map((interval) => [interval.trip._id, interval])
  );
  const ordered = orderedTrips(trips);
  const nextTripById = new Map(ordered.slice(0, -1).map((trip, index) => [trip._id, ordered[index + 1]]));
  const countedStatementDates = new Set();
  const countedDefStatementDates = new Set();

  return ordered
    .filter((trip) => monthOf(trip.loadingDate) === month)
    .map((trip) => {
      const interval = intervalsByTrip.get(trip._id);
      const matchingRecords = interval
        ? dieselRecords.filter((record) => {
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
      matchingRecords.forEach((record) => {
        const recordDate = dateKey(record.date);
        countedStatementDates.add(recordDate);
      });
      const dieselFromDocument = matchingRecords.length
        ? matchingRecords.reduce((sum, record) => sum + (Number(record.litres) || 0), 0)
        : null;
      const defInterval = defIntervalsByTrip.get(trip._id);
      const matchingDefRecords = defInterval
        ? defRecords.filter((record) => {
          const recordDate = dateKey(record.date);
          if (
            recordDate == null
            || recordDate < defInterval.previousTurnDate
            || recordDate > defInterval.currentTurnDate
            || countedDefStatementDates.has(recordDate)
          ) return false;
          return true;
        })
        : [];
      matchingDefRecords.forEach((record) => countedDefStatementDates.add(dateKey(record.date)));
      const defFromDocument = matchingDefRecords.length
        ? matchingDefRecords.reduce((sum, record) => sum + (Number(record.litres) || 0), 0)
        : null;
      const dieselEntries = Array.isArray(trip.dieselEntries) ? trip.dieselEntries : [];
      const dieselAdded = dieselEntries.length
        ? dieselEntries.reduce((sum, entry) => {
          const litres = Number(entry.volumeLitres);
          return Number.isFinite(litres) ? sum + litres : sum;
        }, 0)
        : null;
      const defEntries = Array.isArray(trip.defEntries) ? trip.defEntries : [];
      const nextTrip = nextTripById.get(trip._id);
      const nextTripDefEntries = Array.isArray(nextTrip?.defEntries) ? nextTrip.defEntries : [];
      const defAdded = defEntries.length
        ? defEntries.reduce((sum, entry) => {
          const litres = Number(entry.volumeLitres);
          return Number.isFinite(litres) ? sum + litres : sum;
        }, 0)
        : null;
      const defForTrip = defEntries.length > 0 && nextTripDefEntries.length > 0
        ? defEntries.slice(1).reduce((sum, entry) => sum + (Number(entry.volumeLitres) || 0), 0)
          + (Number(nextTripDefEntries[0].volumeLitres) || 0)
        : null;

      return {
        id: trip._id,
        loading: trip.loadingLocation || '',
        loadingWeightTons: trip.loadingWeightTons ?? null,
        unloading: trip.unloadingLocation || '',
        unloadingDate: trip.unloadingDate || null,
        tripKm: trip.settlement?.totalKm ?? null,
        mileageKmPerLitre: trip.settlement?.mileageKmPerLitre ?? null,
        dieselForTrip: trip.settlement?.totalDieselLitres ?? null,
        tripDiesel: dieselAdded,
        dieselFromDocument,
        defForTrip,
        defAdded,
        defFromDocument,
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
