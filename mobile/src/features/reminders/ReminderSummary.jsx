import React from 'react';
import { Alert } from 'react-native';
import { daysUntil, formatDate, isExpired, remindersExpiringWithin7Days, reminderStatusText } from '@kps/shared';
import { Muted } from '../../ui';
import { spacing } from '../../theme';

// Same numbers as the web ReminderSummary: remaining vs expired document dates.
export function reminderCounts(reminders) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder?.expiryDate).filter(Boolean);
  const expired = dates.filter(isExpired).length;
  return { remaining: dates.length - expired, expired };
}

export function ReminderSummary({ reminders }) {
  const { remaining, expired } = reminderCounts(reminders);
  return <Muted style={{ marginBottom: spacing.md }}>Remaining dates: {remaining} | Expired dates: {expired}</Muted>;
}

// Same idea but totals the number of days (used on the driver page).
export function ReminderDaySummary({ reminders }) {
  const dates = Object.values(reminders || {}).map((reminder) => reminder?.expiryDate).filter(Boolean);
  const totals = dates.reduce((acc, date) => {
    const days = daysUntil(date);
    return days < 0 ? { ...acc, expired: acc.expired + Math.abs(days) } : { ...acc, remaining: acc.remaining + days };
  }, { remaining: 0, expired: 0 });
  return <Muted style={{ marginBottom: spacing.md }}>Remaining days: {totals.remaining} | Expired days: {totals.expired}</Muted>;
}

export function reminderDayStatus(date) {
  if (!date) return 'Remaining days: 0 | Expired days: 0';
  const days = daysUntil(date);
  return days < 0
    ? `Remaining days: 0 | Expired days: ${Math.abs(days)}`
    : `Remaining days: ${days} | Expired days: 0`;
}

// Mobile counterpart of the web ReminderPopup modal: one alert per app session.
let popupShown = false;
export function showReminderPopup(vehicles) {
  if (popupShown) return;
  const lines = (vehicles || []).flatMap((vehicle) => (
    remindersExpiringWithin7Days(vehicle.documentReminders).map(([key, reminder]) => (
      `${vehicle.vehicleNumber} - ${reminder.label || key} - ${formatDate(reminder.expiryDate)} (${reminderStatusText(reminder.expiryDate)})`
    ))
  ));
  if (lines.length === 0) return;
  popupShown = true;
  Alert.alert(
    'Reminder: Expiry Dates',
    `The following vehicle documents are expired or expire within 7 days:\n\n${lines.join('\n')}`,
    [{ text: 'Close' }]
  );
}
