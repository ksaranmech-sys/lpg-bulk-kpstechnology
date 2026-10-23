import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleMaintenanceSection from './VehicleMaintenanceSection';

jest.mock('../driver/VehicleMaintenance', () => ({ vehicle }) => (
  <div>{vehicle ? `Maintenance form for ${vehicle.vehicleNumber}` : 'No vehicle selected'}</div>
));

test('lets admins select a vehicle and displays its maintenance form', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const vehicles = [
    { _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' },
    { _id: 'vehicle-2', vehicleNumber: 'KA02CD5678' },
  ];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<VehicleMaintenanceSection vehicles={vehicles} loading={false} />);
  });
  expect(container.textContent).toContain('Maintenance form for KA01AB1234');
  expect(container.querySelector('#admin-maintenance-title').closest('section').style.order).toBe('9999');

  await act(async () => {
    const select = container.querySelector('#maintenance-vehicle');
    select.value = 'vehicle-2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.textContent).toContain('Maintenance form for KA02CD5678');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
