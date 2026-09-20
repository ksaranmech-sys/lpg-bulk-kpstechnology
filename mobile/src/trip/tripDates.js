import { toDateInputValue } from '@kps/shared';

// Late (backdated) entries are allowed for Advance/Diesel/RTO/Other Expense - they just can't be
// dated after this trip's own close date, so today is the fallback upper bound.
export function getEntryMaxDate(trip) {
  return toDateInputValue(trip?.turnDate) || toDateInputValue(new Date());
}

// Nothing on this trip can predate whichever is later: the driver's joining date, or the
// previous trip's close date (once the driver pressed Trip Close on it).
export function getEntryMinDate(trip) {
  return toDateInputValue(trip?.entryMinDate);
}
