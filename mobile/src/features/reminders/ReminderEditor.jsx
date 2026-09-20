import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expiresWithin30Days, isExpired, reminderStatusText, toDateInputValue } from '@kps/shared';
import { api, errorMessage } from '../../api';
import { Button, Card, DateField, ErrorText, Muted } from '../../ui';
import { colors, spacing } from '../../theme';
import { ReminderDaySummary, ReminderSummary, reminderDayStatus } from './ReminderSummary';

// Port of VehicleReminderEditor (variant="status", driver dashboard) and DriverReminderEditor
// (variant="days", admin driver page). Saves { documentReminders: { key: { expiryDate } } }.
export default function ReminderEditor({ vehicle, onSaved, variant = 'status' }) {
  const [reminderDates, setReminderDates] = useState({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehicle) return;
    setReminderDates(Object.fromEntries(
      Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => [
        key,
        reminder.expiryDate ? toDateInputValue(reminder.expiryDate) : '',
      ])
    ));
    setDirty(false);
  }, [vehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!vehicle) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.updateVehicleReminderDates(vehicle._id, {
        documentReminders: Object.fromEntries(
          Object.entries(reminderDates).map(([key, value]) => [key, { expiryDate: value || null }])
        ),
      });
      onSaved(res.data.vehicle);
      setDirty(false);
      setMessage('Reminder dates saved.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to save reminder dates'));
    } finally {
      setSaving(false);
    }
  }

  if (!vehicle) return null;
  const statusFor = variant === 'days' ? reminderDayStatus : reminderStatusText;

  return (
    <Card title="Reminder / Expiry Dates">
      {variant === 'days'
        ? <ReminderDaySummary reminders={vehicle.documentReminders} />
        : <ReminderSummary reminders={vehicle.documentReminders} />}
      {Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => {
        const expired = isExpired(reminder.expiryDate);
        const soon = !expired && expiresWithin30Days(reminder.expiryDate);
        return (
          <View key={key} style={[styles.row, expired && styles.rowExpired, soon && styles.rowSoon]}>
            <Text style={styles.rowTitle}>{reminder.label || key}</Text>
            <DateField
              value={reminderDates[key] || ''}
              onChange={(value) => {
                setReminderDates((current) => ({ ...current, [key]: value }));
                setDirty(true);
                setMessage('');
              }}
            />
            <Text style={{ color: expired ? colors.danger : colors.muted, fontSize: 13 }}>{statusFor(reminder.expiryDate)}</Text>
          </View>
        );
      })}
      <ErrorText>{error}</ErrorText>
      {message ? <Muted style={{ color: colors.success, marginTop: spacing.sm }}>{message}</Muted> : null}
      {dirty && (
        <Button title="Save Reminder Dates" onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: '#fff',
  },
  rowExpired: { backgroundColor: '#ffe5e5' },
  rowSoon: { backgroundColor: '#fff4bf' },
  rowTitle: { fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
});
