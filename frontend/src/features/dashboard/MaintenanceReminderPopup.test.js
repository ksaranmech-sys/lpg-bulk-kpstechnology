import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import MaintenanceReminderPopup from './MaintenanceReminderPopup';

const vehicles = [{
  _id: 'vehicle-1',
  vehicleNumber: 'KA01AB1234',
  lastKnownOdometer: 14501,
  maintenanceComponents: [{
    name: 'Engine Oil',
    startingOdometerKm: 10000,
    expectedKm: 5000,
    reminderKm: 500,
  }],
}];

test('shows maintenance reminders after each dashboard mount', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  let root = createRoot(container);

  await act(async () => root.render(<MaintenanceReminderPopup vehicles={vehicles} />));
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(container.textContent).toContain('Reminder: Vehicle Maintenance');
  expect(container.textContent).toContain('KA01AB1234 - Engine Oil - Due in 499 km');

  await act(async () => container.querySelector('button').click());
  expect(container.querySelector('[role="alertdialog"]')).toBeNull();

  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () => root.render(<MaintenanceReminderPopup vehicles={vehicles} />));
  expect(container.querySelector('[role="alertdialog"]')).not.toBeNull();

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
