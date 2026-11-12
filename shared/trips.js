import { formatDate, monthKey, isCurrentOrPreviousMonth } from './dates.js';

export function formatTripRoute(trip) {
  const dateOrPending = (value) => (value ? formatDate(value) : 'Date pending');
  return `${trip.loadingLocation || 'Loading pending'} (${dateOrPending(trip.loadingDate)}) -> ${trip.unloadingLocation || 'Unloading pending'} (${dateOrPending(trip.unloadingDate)})`;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function tripClosedDate(trip) {
  const turnDate = validDate(trip.turnDate);
  if (turnDate) return turnDate;

  const dieselEntries = trip.dieselEntries || [];
  const filledAt = validDate(dieselEntries[dieselEntries.length - 1]?.filledAt);
  if (filledAt) return filledAt;

  return validDate(trip.closedAt) || validDate(trip.loadingDate);
}

// Keep trip history month assignment aligned with backend getTripSalaryDate.
export function tripHistoryDate(trip) {
  const candidates = [
    tripClosedDate(trip),
    trip.loadingDate,
    trip.unloadingDate,
    trip.unTurnDate,
  ]
    .filter(Boolean)
    .map((value) => (value instanceof Date ? value : validDate(value)))
    .filter(Boolean);
  if (!candidates.length) return new Date(trip.createdAt);
  return candidates.reduce((latest, date) => (date > latest ? date : latest));
}

export function isTripDeletableWithinDays(trip, days = 45, now = new Date()) {
  const date = tripHistoryDate(trip);
  const nowTime = now.getTime();
  return !Number.isNaN(date.getTime())
    && date.getTime() <= nowTime
    && date.getTime() >= nowTime - days * 24 * 60 * 60 * 1000;
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
