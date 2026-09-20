import React from 'react';
import { isExpired, daysUntil } from '@kps/shared';

// One-line count of remaining vs expired document dates (RC, insurance, permit, ...).
export function ReminderSummary({ reminders }) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder.expiryDate).filter(Boolean);
  const expired = dates.filter(isExpired).length;
  return (
    <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
      Remaining dates: {dates.length - expired} | Expired dates: {expired}
    </p>
  );
}

// Same idea but totals the number of days (used on the driver page).
export function ReminderDaySummary({ reminders }) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder.expiryDate).filter(Boolean);
  const totals = dates.reduce((acc, date) => {
    const days = daysUntil(date);
    return days < 0 ? { ...acc, expired: acc.expired + Math.abs(days) } : { ...acc, remaining: acc.remaining + days };
  }, { remaining: 0, expired: 0 });
  return (
    <p style={{ margin: '0 0 12px', color: '#666', fontSize: 13 }}>
      Remaining days: {totals.remaining} | Expired days: {totals.expired}
    </p>
  );
}

export function reminderDayStatus(date) {
  if (!date) return 'Remaining days: 0 | Expired days: 0';
  const days = daysUntil(date);
  return days < 0
    ? `Remaining days: 0 | Expired days: ${Math.abs(days)}`
    : `Remaining days: ${days} | Expired days: 0`;
}
