import React, { useEffect, useState } from 'react';
import { expiresWithin30Days, isExpired, reminderStatusText } from '@kps/shared';
import * as api from '../../api/api';
import { ReminderSummary } from '../../components/ReminderSummary';

export default function VehicleReminderEditor({ user, vehicles, setVehicles }) {
  const [reminderDates, setReminderDates] = useState({});
  const [reminderDirty, setReminderDirty] = useState(false);
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderMessage, setReminderMessage] = useState('');

  // Seed the editable reminder date inputs from the driver's vehicle.
  const reminderVehicle = user?.role === 'vehicle_user' ? vehicles[0] : null;
  useEffect(() => {
    if (!reminderVehicle) return;
    setReminderDates(Object.fromEntries(
      Object.entries(reminderVehicle.documentReminders || {}).map(([key, reminder]) => [
        key,
        reminder.expiryDate ? new Date(reminder.expiryDate).toISOString().slice(0, 10) : '',
      ])
    ));
    setReminderDirty(false);
  }, [reminderVehicle?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveReminderDates(e) {
    e.preventDefault();
    if (!reminderVehicle) return;
    setReminderSaving(true);
    setReminderMessage('');
    try {
      const res = await api.updateVehicleReminderDates(reminderVehicle._id, {
        documentReminders: Object.fromEntries(
          Object.entries(reminderDates).map(([key, value]) => [key, { expiryDate: value || null }])
        ),
      });
      setVehicles((current) => current.map((v) => (String(v._id) === String(reminderVehicle._id) ? res.data.vehicle : v)));
      setReminderDirty(false);
      setReminderMessage('Reminder dates saved.');
    } catch (err) {
      setReminderMessage(err.response?.data?.error || 'Failed to save reminder dates');
    } finally {
      setReminderSaving(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <h3 className="section-title" style={{ marginTop: 0 }}>Reminder / Expiry Dates</h3>
      <ReminderSummary reminders={vehicles[0].documentReminders} />
      <form className="reminder-form" onSubmit={saveReminderDates}>
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.entries(vehicles[0].documentReminders || {}).map(([key, reminder]) => (
            <div key={key} className="list-item" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 0, alignItems: 'center', background: isExpired(reminder.expiryDate) ? '#ffe5e5' : expiresWithin30Days(reminder.expiryDate) ? '#fff4bf' : undefined }}>
              <strong>{reminder.label || key}</strong>
              <input
                type="date"
                value={reminderDates[key] || ''}
                onChange={(event) => {
                  setReminderDates((current) => ({ ...current, [key]: event.target.value }));
                  setReminderDirty(true);
                  setReminderMessage('');
                }}
              />
              <span style={{ color: isExpired(reminder.expiryDate) ? '#b42318' : '#4a5f52' }}>
                {reminderStatusText(reminder.expiryDate)}
              </span>
            </div>
          ))}
        </div>
        {reminderMessage && <p style={{ margin: '10px 0 0', color: reminderMessage.includes('saved') ? '#1a7f4b' : '#b42318', fontSize: 13 }}>{reminderMessage}</p>}
        {reminderDirty && (
          <button className="btn" type="submit" disabled={reminderSaving} style={{ marginTop: 12 }}>
            {reminderSaving ? 'Saving...' : 'Save Reminder Dates'}
          </button>
        )}
      </form>
    </div>
  );
}
