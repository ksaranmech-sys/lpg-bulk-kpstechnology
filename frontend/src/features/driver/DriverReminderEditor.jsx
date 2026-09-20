import React, { useEffect, useState } from 'react';
import { expiresWithin30Days, isExpired } from '@kps/shared';
import * as api from '../../api/api';
import { ReminderDaySummary as ReminderSummary, reminderDayStatus as getReminderDayStatus } from '../../components/ReminderSummary';

export default function DriverReminderEditor({ vehicle, setData, setError }) {
  const [reminderDates, setReminderDates] = useState({});
  const [reminderDirty, setReminderDirty] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);

  useEffect(() => {
    if (!vehicle) return;
    setReminderDates(Object.fromEntries(
      Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => [
        key,
        reminder.expiryDate ? new Date(reminder.expiryDate).toISOString().slice(0, 10) : '',
      ])
    ));
    setReminderDirty(false);
  }, [vehicle]);

  async function saveReminderDates(event) {
    event.preventDefault();
    if (!vehicle) return;
    setReminderSaving(true);
    setError('');
    try {
      const res = await api.updateVehicleReminderDates(vehicle._id, {
        documentReminders: Object.fromEntries(
          Object.entries(reminderDates).map(([key, value]) => [key, { expiryDate: value || null }])
        ),
      });
      setData((current) => ({
        ...current,
        vehicles: current.vehicles.map((entry) => (
          String(entry._id) === String(vehicle._id) ? res.data.vehicle : entry
        )),
      }));
      setReminderDirty(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save reminder dates');
    } finally {
      setReminderSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Reminder / Expiry Dates</h3>
      <ReminderSummary reminders={vehicle.documentReminders} />
      <form className="reminder-form" onSubmit={saveReminderDates}>
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(vehicle.documentReminders || {}).map(([key, reminder]) => (
            <div key={key} className="list-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0, background: isExpired(reminder.expiryDate) ? '#ffe5e5' : expiresWithin30Days(reminder.expiryDate) ? '#fff4bf' : undefined }}>
              <strong>{reminder.label || key}</strong>
              <input
                type="date"
                value={reminderDates[key] || ''}
                onChange={(event) => {
                  setReminderDates((current) => ({ ...current, [key]: event.target.value }));
                  setReminderDirty(true);
                }}
              />
              <span style={{ color: isExpired(reminder.expiryDate) ? '#b42318' : '#4a5f52' }}>
                {getReminderDayStatus(reminder.expiryDate)}
              </span>
            </div>
          ))}
        </div>
        {reminderDirty && (
          <button className="btn" type="submit" disabled={reminderSaving} style={{ marginTop: 12 }}>
            {reminderSaving ? 'Saving...' : 'Save Reminder Dates'}
          </button>
        )}
      </form>
    </div>
  );
}
