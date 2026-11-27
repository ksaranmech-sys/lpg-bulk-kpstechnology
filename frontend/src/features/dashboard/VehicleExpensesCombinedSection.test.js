import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleExpensesCombinedSection from './VehicleExpensesCombinedSection';

jest.mock('./VehicleExpensesSection', () => ({ vehicles, selectedVehicleId }) => (
  <div>Expense summary for {vehicles.find((vehicle) => vehicle._id === selectedVehicleId)?.vehicleNumber}</div>
));

jest.mock('./VehicleExpenseManagementSection', () => ({ vehicles, selectedVehicleId }) => (
  <div>Expense manager for {vehicles.find((vehicle) => vehicle._id === selectedVehicleId)?.vehicleNumber}</div>
));

test('uses one selector for the expense summary and expense manager', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const vehicles = [
    { _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' },
    { _id: 'vehicle-2', vehicleNumber: 'KA02CD5678' },
  ];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <VehicleExpensesCombinedSection
        vehicles={vehicles}
        expenses={[]}
        loading={false}
        customerId="customer-1"
        canManage
      />
    );
  });

  expect(container.querySelectorAll('select')).toHaveLength(1);
  expect(container.textContent).toContain('Expense summary for KA01AB1234');
  expect(container.textContent).toContain('Expense manager for KA01AB1234');

  await act(async () => {
    const select = container.querySelector('#combined-expense-vehicle');
    select.value = 'vehicle-2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });

  expect(container.textContent).toContain('Expense summary for KA02CD5678');
  expect(container.textContent).toContain('Expense manager for KA02CD5678');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
