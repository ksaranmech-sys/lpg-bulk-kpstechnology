import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  listVehicles: jest.fn(),
  listTripsForVehicle: jest.fn(),
  listLeaves: jest.fn(),
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

test('loads the assigned vehicle open trips from the API on a fresh dashboard mount', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
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

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
