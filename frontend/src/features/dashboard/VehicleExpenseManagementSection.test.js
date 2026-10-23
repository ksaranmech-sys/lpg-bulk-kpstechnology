import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehicleExpenseManagementSection from './VehicleExpenseManagementSection';

jest.mock('../driver/DriverVehicleExpenses', () => ({ customerId, vehicle }) => (
  <div>{`Expense editor for ${vehicle.vehicleNumber} under ${customerId}`}</div>
));

test('selects a dashboard vehicle for expense management', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const vehicles = [
    { _id: 'vehicle-1', vehicleNumber: 'KA01AB1234', customer: { _id: 'customer-1' } },
    { _id: 'vehicle-2', vehicleNumber: 'KA02CD5678', customer: { _id: 'customer-1' } },
  ];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(<VehicleExpenseManagementSection vehicles={vehicles} customerId="customer-1" />);
  });
  expect(container.textContent).toContain('Expense editor for KA01AB1234 under customer-1');

  await act(async () => {
    const select = container.querySelector('#manage-expense-vehicle');
    select.value = 'vehicle-2';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(container.textContent).toContain('Expense editor for KA02CD5678 under customer-1');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
