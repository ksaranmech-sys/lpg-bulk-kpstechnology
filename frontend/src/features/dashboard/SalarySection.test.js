import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import SalarySection from './SalarySection';
import { currentMonth } from '@kps/shared';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getDriverMonthlySalary: jest.fn(),
}));

test('shows only drivers whose active dates overlap the selected salary month', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  api.getDriverMonthlySalary.mockResolvedValue({ data: {} });

  const salaryMonth = currentMonth();
  const monthStart = new Date(`${salaryMonth}-01T00:00:00`);
  const previousMonthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0);
  const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const formatDate = (date) => (
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  );
  const oneDay = `${salaryMonth}-15T00:00:00`;
  const driverUsers = [
    { id: 'active-driver', name: 'Active driver', joiningDate: `${salaryMonth}-01` },
    {
      id: 'one-day-driver',
      name: 'One day driver',
      isActive: false,
      joiningDate: oneDay,
      resigningDate: oneDay,
    },
    {
      id: 'ended-driver',
      name: 'Ended driver',
      joiningDate: '2020-01-01',
      resigningDate: formatDate(previousMonthEnd),
    },
    { id: 'future-driver', name: 'Future driver', joiningDate: `${formatDate(nextMonthStart)}T00:00:00` },
    { id: 'undated-inactive-driver', name: 'Undated inactive driver', isActive: false, joiningDate: '2020-01-01' },
  ];

  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <SalarySection
          user={{ role: 'customer_admin', customer: 'customer-1' }}
          customerData={{ customer: { companyName: 'KPS Transports' }, vehicles: [] }}
          allDriverUsers={driverUsers}
          leaves={[]}
          leavesLoading={false}
        />
      </MemoryRouter>
    );
  });
  await act(async () => {});

  expect(container.textContent).toContain('Active driver');
  expect(container.textContent).toContain('One day driver');
  expect(container.textContent).not.toContain('Ended driver');
  expect(container.textContent).not.toContain('Future driver');
  expect(container.textContent).not.toContain('Undated inactive driver');
  expect(api.getDriverMonthlySalary.mock.calls.map(([, driverId]) => driverId)).toEqual([
    'active-driver',
    'one-day-driver',
  ]);

  await act(async () => root.unmount());
  global.IS_REACT_ACT_ENVIRONMENT = false;
});
