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

export function buildDieselVerificationRows(trips, month, uploads) {
  const dieselRecords = uploads.flatMap((upload) => upload.dieselRecords || []);

  return trips
    .filter((trip) => monthOf(trip.loadingDate) === month)
    .sort((a, b) => (
      dateKey(a.loadingDate) - dateKey(b.loadingDate)
      || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ))
    .map((trip) => {
      const startDate = dateKey(trip.loadingDate);
      const endDate = dateKey(trip.turnDate || trip.unloadingDate);
      const dieselFromId = startDate != null && endDate != null && dieselRecords.length
        ? dieselRecords.reduce((sum, record) => {
          const recordDate = dateKey(record.date);
          return recordDate != null && recordDate >= startDate && recordDate <= endDate
            ? sum + (Number(record.litres) || 0)
            : sum;
        }, 0)
        : null;

      return {
        id: trip._id,
        loading: trip.loadingLocation || '',
        unloading: trip.unloadingLocation || '',
        unloadingDate: trip.unloadingDate || null,
        tripDiesel: trip.settlement?.totalDieselLitres ?? null,
        dieselFromId,
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
