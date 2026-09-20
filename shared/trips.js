import { formatDate, monthKey, isCurrentOrPreviousMonth } from './dates.js';

export function formatTripRoute(trip) {
  const dateOrPending = (value) => (value ? formatDate(value) : 'Date pending');
  return `${trip.loadingLocation || 'Loading pending'} (${dateOrPending(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${dateOrPending(trip.unloadingDate)})`;
}

// The date a trip is filed under in history lists: close (turn) date first, then loading date.
export function tripHistoryDate(trip) {
  return new Date(trip.turnDate || trip.closedAt || trip.loadingDate || trip.createdAt);
}

export function tripHistoryMonthKey(trip) {
  return monthKey(tripHistoryDate(trip));
}

// Closed trips older than the current/previous month are hidden behind "show archived".
export function isArchivedTrip(trip) {
  return trip.status === 'closed' && !isCurrentOrPreviousMonth(tripHistoryMonthKey(trip));
}

// Groups trips into [{ monthKey, monthTrips }], newest month first.
export function groupTripsByMonth(trips) {
  const groups = new Map();
  trips.forEach((trip) => {
    const key = tripHistoryMonthKey(trip);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trip);
  });
  return Array.from(groups.entries())
    .sort(([left], [right]) => (left < right ? 1 : -1))
    .map(([key, monthTrips]) => ({ monthKey: key, monthTrips }));
}
