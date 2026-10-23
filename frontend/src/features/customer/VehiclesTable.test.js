import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VehiclesTable from './VehiclesTable';

const vehicle = {
  _id: 'vehicle-1',
  vehicleNumber: 'KA01AB1234',
  corporation: 'Bharat Petroleum',
  driverName: 'Driver One',
};

async function renderTable(props) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<VehiclesTable {...props} />));
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    },
  };
}

test('customer admins can delete vehicles but cannot add them', async () => {
  const view = await renderTable({
    customerId: 'customer-1',
    data: { vehicles: [vehicle] },
    setData: jest.fn(),
    user: { role: 'customer_admin' },
  });

  expect(view.container.textContent).not.toContain('Add Vehicle');
  expect(view.container.textContent).toContain('Delete selected');
  expect(view.container.querySelector('input[type="checkbox"]')).not.toBeNull();

  await view.unmount();
});

test('super admins can add vehicles', async () => {
  const view = await renderTable({
    customerId: 'customer-1',
    data: { vehicles: [vehicle] },
    setData: jest.fn(),
    user: { role: 'super_admin' },
  });

  expect(view.container.textContent).toContain('Add Vehicle');

  await view.unmount();
});

test('customer detail can show vehicles without add, delete, or expense controls', async () => {
  const view = await renderTable({
    customerId: 'customer-1',
    data: { vehicles: [vehicle] },
    setData: jest.fn(),
    user: { role: 'super_admin' },
    managementEnabled: false,
    vehicleExpenses: [{ vehicle: 'vehicle-1', amount: 100, date: new Date().toISOString() }],
  });

  expect(view.container.textContent).toContain('KA01AB1234');
  expect(view.container.textContent).not.toContain('Add Vehicle');
  expect(view.container.textContent).not.toContain('Delete selected');
  expect(view.container.textContent).not.toContain('Expenses');
  expect(view.container.querySelector('input[type="checkbox"]')).toBeNull();

  await view.unmount();
});
