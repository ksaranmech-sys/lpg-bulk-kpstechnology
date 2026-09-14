import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripDetail from './TripDetail';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  getTrip: jest.fn(),
  getMeta: jest.fn(),
}));

jest.mock('../components/Layout', () => ({ children }) => <>{children}</>);

test('shows editable manual loading details below unloading expenses', async () => {
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

  const headings = Array.from(container.querySelectorAll('h3')).map((heading) => heading.textContent);
  expect(headings.indexOf('Loading Details Added')).toBeGreaterThan(
    headings.indexOf('Unloading Expenses Added')
  );

  const loadingSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Loading Details Added'
  );
  await act(async () => loadingSummary.querySelector('button').click());

  const loadingForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Loading Details'
  );
  expect(loadingForm.querySelector('select')).toBeNull();
  expect(loadingForm.querySelector('input:not([type="date"])').value).toBe('MRPL');
  expect(loadingForm.querySelector('input[type="date"]').value).toBe('2026-09-14');
  expect(loadingForm.querySelector('button').textContent).toBe('Save Loading Details');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
