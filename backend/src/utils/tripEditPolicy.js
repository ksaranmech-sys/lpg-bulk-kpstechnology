const CLOSED_TRIP_EDIT_ERROR =
  'Closed trips can only be edited during their trip month and through the 10th of the following month.';

const indiaDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function getIndiaCalendarParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = Object.fromEntries(
    indiaDateParts.formatToParts(date).map(({ type, value: partValue }) => [type, Number(partValue)])
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function isClosedTripEditable(tripDate, now = new Date()) {
  const tripParts = getIndiaCalendarParts(tripDate);
  const todayParts = getIndiaCalendarParts(now);
  if (!tripParts || !todayParts) return false;

  const tripMonth = tripParts.year * 12 + tripParts.month;
  const currentMonth = todayParts.year * 12 + todayParts.month;
  return tripMonth === currentMonth ||
    (tripMonth === currentMonth - 1 && todayParts.day <= 10);
}

module.exports = { CLOSED_TRIP_EDIT_ERROR, isClosedTripEditable };
