function dateValue(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function monthOf(value) {
  const date = dateValue(value);
  return date ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}` : '';
}

export function buildDieselVerificationRows(trips, month, uploads) {
  const dieselRecords = uploads.flatMap((upload) => upload.dieselRecords || []);

  return trips
    .filter((trip) => monthOf(trip.loadingDate) === month)
    .sort((a, b) => (
      new Date(a.loadingDate).getTime() - new Date(b.loadingDate).getTime()
      || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ))
    .map((trip) => {
      const start = dateValue(trip.loadingDate);
      const end = dateValue(trip.turnDate || trip.unloadingDate);
      const dieselFromId = start && end && dieselRecords.length
        ? dieselRecords.reduce((sum, record) => {
          const date = dateValue(record.date);
          return date && date >= start && date <= end ? sum + (Number(record.litres) || 0) : sum;
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
