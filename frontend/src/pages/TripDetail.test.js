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

// Customer admins are read-only on trips; edit interactions below need an admin who can edit.
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'super_admin' } }),
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

test('shows Trip Income KM and Trip Income for admins between Load Turn Added and Single Trip', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  api.getTrip.mockResolvedValue({
    data: {
      trip: {
        _id: 'trip-2',
        status: 'closed',
        customer: { companyName: 'Customer' },
        driverAdvances: [],
        dieselEntries: [],
        rtoEntries: [],
        otherExpenses: [],
        loadingLocation: 'Total, Mangalore',
        loadingDate: '2026-10-02T00:00:00.000Z',
        unloadingLocation: 'Shimoga',
        unloadingDate: '2026-10-03T00:00:00.000Z',
        unloadingWeightTons: 18,
        isDiverted: true,
        divertUnloadingLocation: 'Davangere',
        divertDate: '2026-10-04T00:00:00.000Z',
        manualKmDivert: 100,
        turnNumber: 7,
        turnDate: '2026-10-05T00:00:00.000Z',
        unTurnNumber: 8,
        unTurnDate: '2026-10-03T00:00:00.000Z',
        tripIncome: {
          weightTons: 18,
          tonnageClass: 18,
          corporation: 'IOC-KA',
          corporationSource: 'route',
          mangaloreBase: true,
          rateTable: { id: 'ka-18mt', title: 'Rate/KM/Ton - KA (18MT)' },
          month: '2026-10',
          legs: [
            { leg: 'load', from: 'Total, Mangalore', to: 'Shimoga', km: 628, kmSource: 'km_table', manualOneWayKm: null, type: 'mangalore-451', rateLabel: '451 Mangalore base', rate: 3.8697, rateMonth: '2026-10', income: 43743.09 },
            { leg: 'divert', from: 'Shimoga', to: 'Davangere', km: 200, kmSource: 'manual', manualOneWayKm: 100, type: 'band', rateLabel: '151~200 KM', rate: 1044.9114, rateMonth: '2026-10', income: 18808.41 },
          ],
          totalKm: 828,
          totalIncome: 62551.5,
          errors: [],
        },
      },
    },
  });
  api.getMeta.mockResolvedValue({ data: { loadingLocations: [], unloadingLocations: [], routeKmTable: [] } });

  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={['/trips/trip-2']}>
        <Routes>
          <Route path="/trips/:tripId" element={<TripDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
  await act(async () => {});

  const headings = Array.from(container.querySelectorAll('h3')).map((h3) => h3.textContent);
  const turnIndex = headings.indexOf('Load Turn Added');
  const incomeIndex = headings.indexOf('Trip Income');
  const singleTripIndex = headings.indexOf('Single Trip');
  expect(turnIndex).toBeGreaterThanOrEqual(0);
  expect(incomeIndex).toBeGreaterThan(turnIndex);
  expect(singleTripIndex).toBeGreaterThan(incomeIndex);

  const card = container.querySelector('[data-testid="trip-income"]');
  expect(card.textContent).toContain('Total, Mangalore \u2192 Shimoga');
  expect(card.textContent).toContain('628 km');
  expect(card.textContent).toContain('Shimoga \u2192 Davangere');
  expect(card.textContent).toContain('Manual KM Divert 100 km x 2');
  expect(card.textContent).toContain('200 km');
  expect(card.textContent).toContain('Total Trip Income KM');
  expect(card.textContent).toContain('828 km');
  expect(card.textContent).toContain('451 Mangalore base: 3.8697 / km / ton');
  expect(card.textContent).toContain('18 t x 628 km x 3.8697');
  expect(card.textContent).toContain('151~200 KM: 1044.9114');
  expect(card.textContent).toContain('18 t x 1044.9114');
  expect(card.textContent).toContain('Rate/KM/Ton - KA (18MT) - Oct-26');
  expect(card.textContent).toContain('62,551.50');
  // the card is not part of the printable Single Trip area
  expect(card.closest('.trip-details-print-area')).toBeNull();

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
