import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripDetail from './TripDetail';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  getTrip: jest.fn(),
  getMeta: jest.fn(),
  addAdvance: jest.fn(),
  updateAdvance: jest.fn(),
  setLoadingDetailsWithPhoto: jest.fn(),
  setTurnDetails: jest.fn(),
  closeTrip: jest.fn(),
  setUnloading: jest.fn(),
  setUnloadingTurnDetails: jest.fn(),
  deleteUnloadingTurnDetails: jest.fn(),
  getCurrentPosition: jest.fn(),
  addDieselEntry: jest.fn(),
  updateDieselEntry: jest.fn(),
  deleteDieselEntry: jest.fn(),
  addRtoEntry: jest.fn(),
  updateRtoEntry: jest.fn(),
  addOtherExpense: jest.fn(),
  updateOtherExpense: jest.fn(),
  deleteOtherExpense: jest.fn(),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'customer_admin' } }),
}));

jest.mock('../components/Layout', () => ({ children }) => <>{children}</>);

test('renders trip sections in order and toggles divert fields', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  api.getTrip.mockResolvedValue({
    data: {
      trip: {
        _id: 'trip-1',
        status: 'open',
        customer: { companyName: 'Customer' },
        driverAdvances: [],
        dieselEntries: [],
        rtoEntries: [],
        otherExpenses: [],
        loadingLocation: 'MRPL',
        loadingDate: '2026-09-14T00:00:00.000Z',
        loadingExpense: 100,
        unloadingLocation: 'Depot',
        unloadingDate: '2026-09-15T00:00:00.000Z',
        unloadingExpense: 50,
        turnNumber: 7,
        turnDate: '2026-09-13T00:00:00.000Z',
        unTurnNumber: 8,
        unTurnDate: '2026-09-14T00:00:00.000Z',
      },
    },
  });
  api.getMeta.mockResolvedValue({
    data: { loadingLocations: [], unloadingLocations: [], routeKmTable: [] },
  });

  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/trips/trip-1']}>
        <Routes>
          <Route path="/trips/:tripId" element={<TripDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
  await act(async () => {});

  expect(api.getTrip).toHaveBeenCalledWith('trip-1');

  const heading = container.querySelector('h2');
  expect(heading.textContent).toContain('MRPL');
  expect(heading.textContent).toContain('Depot');

  const headings = Array.from(container.querySelectorAll('h3')).map((h3) => h3.textContent);
  const advanceIndex = headings.indexOf('Advance');
  const loadingIndex = headings.indexOf('Loading Details & Expenses');
  const dieselIndex = headings.indexOf('Diesel');
  const rtoIndex = headings.indexOf('RTO Expenses');
  const otherIndex = headings.indexOf('Other Expenses');
  expect(advanceIndex).toBeGreaterThanOrEqual(0);
  expect(loadingIndex).toBeGreaterThan(advanceIndex);
  expect(dieselIndex).toBeGreaterThan(loadingIndex);
  expect(rtoIndex).toBeGreaterThan(dieselIndex);
  expect(otherIndex).toBeGreaterThan(rtoIndex);

  const unloadingSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Unloading Details'
  );
  await act(async () => unloadingSummary.querySelector('button').click());
  const unloadingForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Unloading Details'
  );
  expect(unloadingForm).not.toBeUndefined();
  const divertCheckbox = Array.from(unloadingForm.querySelectorAll('input[type="checkbox"]')).find(
    (checkbox) => checkbox.closest('.field').textContent.includes('Divert')
  );
  expect(divertCheckbox.checked).toBe(false);
  expect(unloadingForm.querySelector('.divert-fields')).toBeNull();
  await act(async () => divertCheckbox.click());
  const divertFields = unloadingForm.querySelector('.divert-fields');
  expect(divertFields).not.toBeNull();
  expect(divertFields.textContent).toContain('Divert Location');
  expect(divertFields.textContent).toContain('Divert Unloading Date');
  expect(divertFields.querySelector('input[type="date"]')).not.toBeNull();

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
