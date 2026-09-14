import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripDetail from './TripDetail';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  getTrip: jest.fn(),
  getMeta: jest.fn(),
  setTurnDetails: jest.fn(),
  closeTrip: jest.fn(),
  setUnloadingTurnDetails: jest.fn(),
  deleteUnloadingTurnDetails: jest.fn(),
}));

jest.mock('../components/Layout', () => ({ children }) => <>{children}</>);

test('shows editable manual loading details below driver advance', async () => {
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

  const headings = Array.from(container.querySelectorAll('h3')).map((heading) => heading.textContent);
  expect(headings.indexOf('Loading Details Added')).toBeGreaterThan(
    headings.indexOf('Add Driver Advance')
  );

  const loadingSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Loading Details Added'
  );
  await act(async () => loadingSummary.querySelector('button').click());

  const loadingForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Loading Details'
  );
  expect(loadingForm).not.toBeNull();
  expect(loadingForm.querySelector('select')).not.toBeNull();
  expect(loadingForm.querySelectorAll('input').length).toBeGreaterThanOrEqual(2);
  expect(loadingForm.querySelector('input[type="date"]').value).toBe('2026-09-14');
  expect(loadingForm.querySelector('button').textContent).toBe('Save loading details');

  const turnHeadings = Array.from(container.querySelectorAll('h3')).map((heading) => heading.textContent);
  expect(turnHeadings.indexOf('L Turn Added')).toBeGreaterThan(
    turnHeadings.indexOf('Unloading Expenses Added')
  );
  expect(turnHeadings.indexOf('L Turn Added')).toBeGreaterThan(
    turnHeadings.indexOf('Other Expenses Added')
  );
  const turnSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'L Turn Added'
  );
  await act(async () => turnSummary.querySelector('button').click());
  const turnForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'L Turn'
  );
  expect(turnForm.querySelector('input[type="number"]').value).toBe('7');
  expect(turnForm.querySelector('input[type="date"]').value).toBe('2026-09-13');
  expect(turnForm.querySelector('button').textContent).toBe('Trip close');
  api.setTurnDetails.mockResolvedValue({ data: { trip: {} } });
  api.closeTrip.mockResolvedValue({ data: { trip: { status: 'closed' } } });
  await act(async () => turnForm.requestSubmit());
  expect(api.setTurnDetails).toHaveBeenCalledWith('trip-1', {
    turnNumber: 7,
    turnDate: '2026-09-13',
    fillingOrderLocation: undefined,
    manualKm: undefined,
  });
  expect(api.closeTrip).toHaveBeenCalledWith('trip-1');

  const unTurnHeadings = Array.from(container.querySelectorAll('h3')).map((heading) => heading.textContent);
  expect(unTurnHeadings.indexOf('UN Turn Added')).toBeLessThan(
    unTurnHeadings.indexOf('Unloading Details Added')
  );
  const unTurnSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'UN Turn Added'
  );
  expect(unTurnSummary.textContent).toContain('Turn 8');
  window.confirm = jest.fn(() => true);
  api.deleteUnloadingTurnDetails.mockResolvedValue({ data: {} });
  await act(async () => unTurnSummary.querySelector('button').click());
  expect(api.deleteUnloadingTurnDetails).toHaveBeenCalledWith('trip-1');

  const dieselForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Diesel Filling Entry'
  );
  const dieselConfirmation = dieselForm.querySelector('input[type="checkbox"]');
  const addDieselButton = dieselForm.querySelector('button[type="submit"]');
  expect(dieselConfirmation.checked).toBe(false);
  expect(addDieselButton.disabled).toBe(true);
  await act(async () => dieselConfirmation.click());
  expect(dieselConfirmation.checked).toBe(true);
  expect(addDieselButton.disabled).toBe(false);

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});
