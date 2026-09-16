import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TripDetail from './TripDetail';
import { findMissingRouteLegs } from './TripDetail';
import * as api from '../api/api';

jest.mock('../api/api', () => ({
  getTrip: jest.fn(),
  getMeta: jest.fn(),
  setTurnDetails: jest.fn(),
  closeTrip: jest.fn(),
  setUnloading: jest.fn(),
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
  expect(turnHeadings.indexOf('Load Turn Added')).toBeGreaterThan(
    turnHeadings.indexOf('Unloading Expenses Added')
  );
  expect(turnHeadings.indexOf('Load Turn Added')).toBeGreaterThan(
    turnHeadings.indexOf('Other Expenses Added')
  );
  const turnSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Load Turn Added'
  );
  await act(async () => turnSummary.querySelector('button').click());
  const turnForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Load Turn'
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
  expect(unTurnHeadings.indexOf('Unload Turn Added')).toBeLessThan(
    unTurnHeadings.indexOf('Unloading Details Added')
  );
  const unTurnSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Unload Turn Added'
  );
  expect(unTurnSummary.textContent).toContain('Turn 8');
  window.confirm = jest.fn(() => true);
  api.deleteUnloadingTurnDetails.mockResolvedValue({ data: {} });
  await act(async () => unTurnSummary.querySelector('button').click());
  expect(api.deleteUnloadingTurnDetails).toHaveBeenCalledWith('trip-1');

  const unloadingSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Unloading Details Added'
  );
  await act(async () => unloadingSummary.querySelector('button').click());
  const unloadingForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Unloading Details'
  );
  const divertCheckbox = Array.from(unloadingForm.querySelectorAll('input[type="checkbox"]')).find(
    (checkbox) => checkbox.parentElement.textContent.includes('Divert')
  );
  expect(divertCheckbox.checked).toBe(false);
  expect(unloadingForm.querySelector('.divert-fields')).toBeNull();
  await act(async () => divertCheckbox.click());
  const divertFields = unloadingForm.querySelector('.divert-fields');
  expect(divertFields).not.toBeNull();
  expect(divertFields.children).toHaveLength(2);
  expect(divertFields.querySelector('select')).not.toBeNull();
  expect(divertFields.querySelector('input[type="date"]')).not.toBeNull();
  expect(divertFields.textContent).toContain('New Unloading Date');

  const dieselForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Diesel Filling Entry'
  );
  const dieselConfirmation = dieselForm.querySelector('input[type="checkbox"]');
  const addDieselButton = dieselForm.querySelector('button[type="submit"]');
  expect(dieselConfirmation.parentElement.classList.contains('tank-fill-control')).toBe(true);
  expect(dieselConfirmation.parentElement.textContent).toContain('Tank Fill');
  expect(dieselConfirmation.checked).toBe(false);
  expect(addDieselButton.disabled).toBe(false);
  await act(async () => dieselConfirmation.click());
  expect(dieselConfirmation.checked).toBe(true);
  expect(addDieselButton.disabled).toBe(false);

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

test('requires Manual KM inside Load Turn and lists the unresolved route before saving', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  api.getTrip.mockResolvedValue({
    data: {
      trip: {
        _id: 'trip-2',
        status: 'open',
        customer: { companyName: 'Customer' },
        driverAdvances: [],
        dieselEntries: [],
        rtoEntries: [],
        otherExpenses: [],
        loadingLocation: 'Plant',
        loadingDate: '2026-09-14T00:00:00.000Z',
        loadingExpense: 1,
        unloadingLocation: 'Depot',
        unloadingDate: '2026-09-15T00:00:00.000Z',
        unloadingExpense: 1,
        turnNumber: 7,
        turnDate: '2026-09-16T00:00:00.000Z',
      },
    },
  });
  api.getMeta.mockResolvedValue({
    data: {
      routeKmTable: [
        { loadingLocation: 'Plant', unloadingLocation: 'Depot', km: 100 },
        { loadingLocation: 'Filling Plant', unloadingLocation: 'Elsewhere', km: 200 },
      ],
    },
  });
  api.setTurnDetails.mockResolvedValue({ data: { trip: {} } });
  api.closeTrip.mockResolvedValue({ data: { trip: { status: 'closed' } } });

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

  const turnSummary = Array.from(container.querySelectorAll('.card')).find(
    (card) => card.querySelector('h3')?.textContent === 'Load Turn Added'
  );
  await act(async () => turnSummary.querySelector('button').click());
  const turnForm = Array.from(container.querySelectorAll('form')).find(
    (form) => form.querySelector('h3')?.textContent === 'Load Turn'
  );
  const fillingInput = Array.from(turnForm.querySelectorAll('input')).find(
    (input) => input.placeholder === 'Enter filling order location'
  );
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(fillingInput, 'Filling Plant');
    fillingInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => turnForm.requestSubmit());

  const manualKmForm = container.querySelector('[role="region"][aria-labelledby="manual-km-title"]');
  expect(manualKmForm).not.toBeNull();
  expect(turnForm.contains(manualKmForm)).toBe(true);
  const routeInputs = Array.from(manualKmForm.querySelectorAll('input[readonly]'));
  expect(routeInputs.map((input) => input.value)).toEqual(['Filling Plant', 'Depot']);
  expect(api.setTurnDetails).not.toHaveBeenCalled();

  const manualInput = manualKmForm.querySelector('#manual-km-input');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(manualInput, '250');
    manualInput.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    Array.from(manualKmForm.querySelectorAll('button')).find((button) => button.textContent === 'Continue save').click();
  });

  expect(api.setTurnDetails).toHaveBeenCalledWith('trip-2', {
    turnNumber: 7,
    turnDate: '2026-09-16',
    fillingOrderLocation: 'Filling Plant',
    manualKm: 250,
  });
  expect(api.closeTrip).toHaveBeenCalledWith('trip-2');

  await act(async () => root.unmount());
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

test('route leg detection waits for complete route fields and covers diverted trips', () => {
  expect(findMissingRouteLegs({ loadingLocation: 'A', unloadingLocation: 'B' }, [])).toEqual([]);
  expect(findMissingRouteLegs({
    loadingLocation: 'A',
    unloadingLocation: 'B',
    fillingOrderLocation: 'C',
    isDiverted: true,
    divertUnloadingLocation: 'D',
  }, [{ loadingLocation: 'A', unloadingLocation: 'B', km: 10 }])).toEqual([
    { from: 'B', to: 'D' },
    { from: 'C', to: 'D' },
  ]);
});
