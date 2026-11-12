import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleTyreDetails from './VehicleTyreDetails';

jest.mock('../../api/api', () => ({
  updateVehicleTyres: jest.fn(),
}));

test('renders tyre details as a bordered table with labeled inputs for each position', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <VehicleTyreDetails
        vehicle={{
          _id: 'vehicle-1',
          vehicleNumber: 'KA01AB1234',
          lastKnownOdometer: 1000,
          tyres: [{ position: 1, tyreNumber: 'TYRE-001', installedOdometerKm: 500 }],
        }}
      />
    );
  });

  const table = container.querySelector('.tyre-details-table');
  expect(table).not.toBeNull();
  expect(table.querySelectorAll('thead th')).toHaveLength(5);
  expect(table.querySelector('thead').textContent).toContain('Installed ODO (km)');
  expect(table.querySelector('thead').textContent).not.toContain('Installed Odometer');
  expect(table.querySelectorAll('tbody tr')).toHaveLength(7);
  expect(table.querySelector('tbody th[scope="row"]').textContent).toBe('Front Tyre');
  expect(container.querySelector('[aria-label="Tyre Number 1 for Front Tyre"]').value).toBe('TYRE-001');
  expect(container.querySelector('[aria-label="Tyre Number 2 for Front Tyre"]')).not.toBeNull();
  expect(container.querySelector('.tyre-number-fields').children).toHaveLength(2);
  expect(container.querySelectorAll('.tyre-number-field span')).toHaveLength(0);
  expect(container.querySelector('[aria-label="Mileage upto now for Front Tyre (km)"]').value).toBe('500');
  [
    'Installed ODO for Front Tyre (km)',
    'Mileage upto now for Front Tyre (km)',
    'Expected Mileage for Front Tyre (km)',
  ].forEach((label) => {
    const input = container.querySelector(`[aria-label="${label}"]`);
    expect(input.maxLength).toBe(7);
    expect(input.inputMode).toBe('numeric');
  });
  expect(container.querySelectorAll('.tyre-details-input')).toHaveLength(35);

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
