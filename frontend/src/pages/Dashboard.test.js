import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  listVehicles: jest.fn(),
  listTripsForVehicle: jest.fn(),
  listLeaves: jest.fn(),
  getCustomer: jest.fn(),
  listVehicleExpenses: jest.fn(),
  reportDownloadUrl: jest.fn(),
}));

const mockAuthenticatedDriver = {
  id: 'driver-1',
  role: 'vehicle_user',
  customer: 'customer-1',
  vehicle: 'vehicle-1',
};

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthenticatedDriver }),
}));

jest.mock('../components/Layout', () => ({ children }) => <>{children}</>);
jest.mock('../features/dashboard/MonthlyIncomeSection', () => () => <div>Monthly income</div>);
jest.mock('../features/dashboard/SalarySection', () => () => <div>Salary Details</div>);
jest.mock('../features/dashboard/DriverList', () => () => <div>Vehicle and driver list</div>);
jest.mock('../features/dashboard/AdminLeaveSection', () => () => <div>Leave entries</div>);
jest.mock('../features/dashboard/VehicleReminderEditor', () => () => <div>Reminder / Expiry Dates</div>);
jest.mock('../features/dashboard/VehicleMaintenanceSection', () => () => <div>Vehicle Maintenance</div>);
jest.mock('../features/dashboard/VehicleExpensesSection', () => () => <div data-dashboard-section="vehicle-expenses">Vehicle Expenses</div>);
jest.mock('../features/dashboard/VehicleExpenseManagementSection', () => () => <div data-dashboard-section="manage-vehicle-expenses">Manage Vehicle Expenses</div>);
jest.mock('../features/dashboard/MaintenanceReminderPopup', () => () => null);
jest.mock('../features/customer/VehiclesTable', () => () => null);

test('loads the assigned vehicle open trips from the API on a fresh dashboard mount', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuthenticatedDriver.role = 'vehicle_user';
  api.listVehicles.mockResolvedValue({
    data: { vehicles: [{ _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' }] },
  });
  api.listTripsForVehicle.mockResolvedValue({
    data: {
      trips: [{
        _id: 'trip-1',
        status: 'open',
        loadingLocation: 'MRPL',
        createdAt: '2026-09-14T00:00:00.000Z',
      }],
    },
  });
  api.listLeaves.mockResolvedValue({ data: { leaves: [] } });

  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  });
  await act(async () => {});

  expect(api.listTripsForVehicle).toHaveBeenCalledWith('vehicle-1');
  expect(container.textContent).toContain('Open Trips (1)');
  expect(container.textContent).toContain('MRPL');
  expect(container.textContent).not.toContain('Reminder / Expiry Dates');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

test('orders customer admin dashboard sections as requested', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  mockAuthenticatedDriver.role = 'customer_admin';
  mockAuthenticatedDriver.customer = 'customer-1';
  api.listVehicles.mockResolvedValue({
    data: { vehicles: [{ _id: 'vehicle-1', vehicleNumber: 'KA01AB1234' }] },
  });
  api.getCustomer.mockResolvedValue({
    data: { customer: { _id: 'customer-1' }, users: [], vehicles: [] },
  });
  api.listLeaves.mockResolvedValue({ data: { leaves: [] } });
  api.listVehicleExpenses.mockResolvedValue({ data: { expenses: [] } });

  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
  });
  await act(async () => {});

  const sections = Array.from(container.querySelectorAll('[data-dashboard-section]'))
    .sort((a, b) => Number(a.parentElement.style.order) - Number(b.parentElement.style.order))
    .map((section) => section.dataset.dashboardSection);
  expect(sections).toEqual([
    'monthly-income',
    'salary-details',
    'vehicle-driver-list',
    'leave-entries',
    'vehicle-expenses',
    'manage-vehicle-expenses',
    'trip-history',
    'reminder-expiry',
    'vehicle-maintenance',
  ]);

  await act(async () => root.unmount());
  mockAuthenticatedDriver.role = 'vehicle_user';
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
