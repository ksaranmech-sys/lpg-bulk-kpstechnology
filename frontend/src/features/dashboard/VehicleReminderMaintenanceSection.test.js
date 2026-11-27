import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleReminderMaintenanceSection from './VehicleReminderMaintenanceSection';

jest.mock('./VehicleReminderEditor', () => ({ vehicles, selectedVehicleId }) => (
  <div>Reminder for {vehicles.find((vehicle) => vehicle._id === selectedVehicleId)?.vehicleNumber}</div>
));

jest.mock('./VehicleMaintenanceSection', () => ({ vehicles, selectedVehicleId }) => (
  <div>Maintenance for {vehicles.find((vehicle) => vehicle._id === selectedVehicleId)?.vehicleNumber}</div>
));

test('uses one vehicle selector for reminders and maintenance', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const vehicles = [
    { _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' },
    { _id: 'vehicle-2', vehicleNumber: 'KA02CD5678' },
  ];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <VehicleReminderMaintenanceSection
        vehicles={vehicles}
        loading={false}
        setVehicles={() => {}}
        onVehicleUpdated={() => {}}
      />
    );
  });

  expect(container.querySelectorAll('select')).toHaveLength(1);
  expect(container.textContent).toContain('Reminder for KA01AB1234');
  expect(container.textContent).toContain('Maintenance for KA01AB1234');

  await act(async () => {
    const select = container.querySelector('#reminder-maintenance-vehicle');
    select.value = 'vehicle-2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  expect(container.textContent).toContain('Reminder for KA02CD5678');
  expect(container.textContent).toContain('Maintenance for KA02CD5678');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
