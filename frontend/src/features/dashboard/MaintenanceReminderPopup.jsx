import React, { useEffect, useState } from 'react';
import { getMaintenanceReminderAlerts } from './maintenanceReminderAlerts';

export default function MaintenanceReminderPopup({ vehicles }) {
  const [alerts, setAlerts] = useState([]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nextAlerts = getMaintenanceReminderAlerts(vehicles);
    setAlerts(nextAlerts);
    setVisible(nextAlerts.length > 0);
  }, [vehicles]);

  if (!visible) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2001, padding: 20, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" role="alertdialog" aria-modal="true" aria-labelledby="maintenance-reminder-title" style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', margin: 0 }}>
        <h3 id="maintenance-reminder-title" style={{ marginTop: 0 }}>Vehicle Maintenance Reminder</h3>
        <p style={{ color: '#555' }}>These components are due soon or overdue:</p>
        <ul style={{ margin: '0 0 20px', paddingLeft: 20 }}>
          {alerts.map((alert) => (
            <li key={alert.key} style={{ marginBottom: 8 }}>
              <strong>{alert.vehicleNumber}</strong> - {alert.componentName} - {alert.overdue
                ? `Overdue by ${Math.abs(alert.remainingKm).toLocaleString()} km`
                : `Due in ${alert.remainingKm.toLocaleString()} km`}
            </li>
          ))}
        </ul>
        <button className="btn" type="button" onClick={() => setVisible(false)}>Close</button>
      </div>
    </div>
  );
}
