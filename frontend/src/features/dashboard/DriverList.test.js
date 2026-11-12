import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import DriverList from './DriverList';

test('shows vehicle and corporation on the left and driver contact details on the right without expenses', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <DriverList
          user={{ customer: 'customer-1' }}
          vehicles={[{ _id: 'vehicle-1', vehicleNumber: 'KA01AB1234', corporation: 'IOC' }]}
          setVehicles={jest.fn()}
          customerData={null}
          setCustomerData={jest.fn()}
          driverUsers={[{
            id: 'driver-1',
            name: 'Ravi',
            username: 'ravi-user',
            mobileNumber: '9876543210',
            joiningDate: '2026-09-01',
            vehicle: 'vehicle-1',
          }]}
        />
      </MemoryRouter>
    );
  });

  const row = container.querySelector('.list-item');
  expect(row.textContent).toContain('KA01AB1234, IOC');
  expect(row.textContent).not.toContain('Corporation:');
  expect(row.textContent).toContain('Ravi');
  expect(row.textContent).toContain('9876543210');
  expect(row.textContent).toContain(new Date('2026-09-01').toLocaleDateString('en-IN'));
  expect(row.textContent).not.toContain('Expenses');
  expect(row.style.gridTemplateColumns).toBe('auto minmax(0, 1fr) minmax(0, 1fr)');
  expect(row.querySelector('.driver-list-driver-details').tagName).toBe('SPAN');
  expect(row.querySelector('strong').style.fontSize).toBe('14px');
  expect(row.querySelector('a').style.fontSize).toBe('14px');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
