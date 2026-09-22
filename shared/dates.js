// Date helpers. All month keys are 'YYYY-MM' strings; all "today" math uses the device's local
// calendar day (never toISOString, which shifts dates backwards for IST early in the morning).

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function monthKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(today = new Date()) {
  return monthKey(today);
}

export function previousMonth(today = new Date()) {
  return monthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

// Salary for a month can be calculated from the end of the following month.
export function latestCalculableMonth(today = new Date()) {
  const lastDayOfThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthsBack = today.getDate() >= lastDayOfThisMonth ? 1 : 2;
  return monthKey(new Date(today.getFullYear(), today.getMonth() - monthsBack, 1));
}

export function isCurrentOrPreviousMonth(key, today = new Date()) {
  return key === currentMonth(today) || key === previousMonth(today);
}

export function formatMonthLabel(key) {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function formatDate(value, options) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', options);
}

export function formatDateLong(value) {
  return formatDate(value, { day: '2-digit', month: 'short', year: 'numeric' });
}

// 'YYYY-MM-DD' for <input type="date"> using the local calendar day.
export function toDateInputValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Whole days from today until `date` (negative when already past).
export function daysUntil(date, today = new Date()) {
  return Math.ceil((startOfDay(date) - startOfDay(today)) / DAY_MS);
}

export function isExpired(date) {
  return Boolean(date) && daysUntil(date) < 0;
}

export function expiresWithin30Days(date) {
  if (!date) return false;
  const days = daysUntil(date);
  return days >= 0 && days <= 30;
}

export function reminderStatusText(date) {
  if (!date) return 'Not set';
  if (isExpired(date)) return 'Expired';
  return `${daysUntil(date)} day(s) remaining`;
}

// Entries of `reminders` ({ key: { expiryDate } }) that expire within 7 days or already have.
export function remindersExpiringWithin7Days(reminders) {
  return Object.entries(reminders || {}).filter(([, reminder]) => (
    reminder?.expiryDate && daysUntil(reminder.expiryDate) <= 7
  ));
}
