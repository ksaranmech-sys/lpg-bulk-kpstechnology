import { formatDate, monthKey, isCurrentOrPreviousMonth } from './dates.js';

export function formatTripRoute(trip) {
  const dateOrPending = (value) => (value ? formatDate(value) : 'Date pending');
  return `${trip.loadingLocation || 'Loading pending'} (${dateOrPending(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${dateOrPending(trip.unloadingDate)})`;
}

// The date a trip is filed under in history lists. Mirrors backend getTripSalaryDate: the close
// date, bumped forward if loading / unloading / turn dates fall in a later month.
export function tripHistoryDate(trip) {
  const candidates = [
    trip.turnDate || trip.closedAt,
    trip.loadingDate,
    trip.unloadingDate,
    trip.unTurnDate,
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (!candidates.length) return new Date(trip.createdAt);
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
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
