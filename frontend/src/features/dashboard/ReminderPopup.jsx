import React, { useEffect, useState } from 'react';
import { remindersExpiringWithin7Days, reminderStatusText } from '@kps/shared';

export default function ReminderPopup({ user, vehicles }) {
  const [expiringReminders, setExpiringReminders] = useState([]);
  const [showReminderPopup, setShowReminderPopup] = useState(false);

  useEffect(() => {
    if (!['vehicle_user', 'customer_admin'].includes(user?.role) || !vehicles.length) {
      setExpiringReminders([]);
      setShowReminderPopup(false);
      return;
    }
    const entries = vehicles.flatMap((vehicle) => (
      remindersExpiringWithin7Days(vehicle.documentReminders).map(([key, reminder]) => ({
        key: `${vehicle._id}-${key}`,
        label: reminder.label || key,
        date: reminder.expiryDate,
        vehicleNumber: vehicle.vehicleNumber,
      }))
    ));
    setExpiringReminders(entries);
    setShowReminderPopup(entries.length > 0);
  }, [user, vehicles]);

  if (!showReminderPopup) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 540, margin: 0 }}>
        <h3 style={{ marginTop: 0 }}>Reminder: Expiry Dates</h3>
        <p style={{ color: '#555' }}>The following vehicle documents are expired or expire within 7 days:</p>
        <ul style={{ margin: '0 0 20px', paddingLeft: 18 }}>
          {expiringReminders.map(({ key, label, date, vehicleNumber }) => (
            <li key={key} style={{ marginBottom: 8 }}>
              <strong>{vehicleNumber}</strong> - {label} - {new Date(date).toLocaleDateString('en-IN')} ({reminderStatusText(date)})
            </li>
          ))}
        </ul>
        <button className="btn" type="button" onClick={() => setShowReminderPopup(false)}>Close</button>
      </div>
    </div>
  );
}
