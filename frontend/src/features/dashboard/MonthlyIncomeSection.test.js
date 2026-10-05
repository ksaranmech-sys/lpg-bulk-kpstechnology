import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MonthlyIncomeSection from './MonthlyIncomeSection';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getCustomerMonthlyIncome: jest.fn(),
}));

const rates = { tds: 0.02, diesel: 0.4, amount: 0.6 };
const row = (overrides) => ({
  sNo: 1,
  tripId: 't1',
  vehicleNumber: 'KA01AA0001',
  loadingLocation: 'AEGIS, Mangalore',
  unloadingLocation: 'Belgaum',
  leg: 'load',
  month: '2026-09',
  loadingDate: '2026-09-05T03:00:00Z',
  unloadingDate: '2026-09-07T03:00:00Z',
  status: 'closed',
  corporation: 'IOC-KA',
  tripIncome: 10000,
  tds: 200,
  diesel: 3920,
  amount: 5880,
  notes: [],
  ...overrides,
});

function response(month, groups) {
  const all = groups.flatMap((g) => g.rows);
  const sum = (key) => all.reduce((s, r) => s + (r[key] || 0), 0);
  return {
    data: {
      month,
      rates,
      groups,
      totals: { trips: all.length, pricedTrips: all.filter((r) => r.tripIncome != null).length, tripIncome: sum('tripIncome'), tds: sum('tds'), diesel: sum('diesel'), amount: sum('amount') },
    },
  };
}

async function mount(ui) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  await act(async () => {});
  return {
    container,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function buttonByText(container, text) {
  return Array.from(container.querySelectorAll('button')).find((button) => button.textContent.trim() === text);
}

async function click(element) {
  await act(async () => { element.click(); });
  await act(async () => {});
}

async function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {});
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers().setSystemTime(new Date('2026-10-04T10:00:00'));
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
  global.IS_REACT_ACT_ENVIRONMENT = false;
});

test('shows last month by default, one table per corporation with the TDS / Diesel / Amount split', async () => {
  api.getCustomerMonthlyIncome.mockResolvedValue(response('2026-09', [
    { corporation: 'IOC-KA', known: true, rows: [row()], totals: { trips: 1, pricedTrips: 1, tripIncome: 10000, tds: 200, diesel: 3920, amount: 5880 } },
    { corporation: 'IOC-TN', known: true, rows: [
      row({ tripId: 't2', vehicleNumber: 'TN01BB0001', corporation: 'IOC-TN', tripIncome: null, tds: null, diesel: null, amount: null, status: 'open', notes: ['Unloading weight (tons) is required to calculate Trip Income.'] }),
      row({ sNo: 2, tripId: 't3', leg: 'divert', vehicleNumber: 'TN01BB0002', corporation: 'IOC-TN', loadingLocation: 'Chengalpattu', unloadingLocation: 'Salem', unloadingDate: '2026-09-12T03:00:00Z', tripIncome: 5000, tds: 100, diesel: 1960, amount: 2940 }),
    ], totals: { trips: 2, pricedTrips: 1, tripIncome: 5000, tds: 100, diesel: 1960, amount: 2940 } },
  ]));

  const { container, unmount } = await mount(<MemoryRouter><MonthlyIncomeSection customerId="c1" /></MemoryRouter>);

  expect(api.getCustomerMonthlyIncome).toHaveBeenCalledWith('c1', '2026-09');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (September 2026)');

  const ka = container.querySelector('[data-testid="income-group-IOC-KA"]');
  const tn = container.querySelector('[data-testid="income-group-IOC-TN"]');
  expect(ka).not.toBeNull();
  expect(tn).not.toBeNull();

  const headers = Array.from(ka.querySelectorAll('thead th')).map((th) => th.textContent);
  expect(headers).toEqual([
    'S.No', 'Vehicle Number', 'Loading location', 'Unloading location', 'Loading date', 'Unloading date', 'Trip Income',
    'TDSTrip Income x 2%', 'Diesel(Trip Income - TDS) x 40%', 'Amount(Trip Income - TDS) x 60%',
  ]);
  const kaRows = Array.from(ka.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent));
  expect(kaRows[0]).toEqual(['1', 'KA01AA0001', 'AEGIS, Mangalore', 'Belgaum', '05 Sept 2026', '07 Sept 2026', '₹10,000.00', '₹200.00', '₹3,920.00', '₹5,880.00']);
  expect(kaRows[1]).toEqual(['Total', '₹10,000.00', '₹200.00', '₹3,920.00', '₹5,880.00']);
  expect(ka.querySelector('tbody tr td a').getAttribute('href')).toBe('/trips/t1');

  expect(tn.textContent).toContain('NA');
  expect(tn.textContent).toContain('Unloading weight (tons) is required');
  expect(tn.textContent).toContain('1 unloading(s) without income not included');
  const divertRow = Array.from(tn.querySelectorAll('tbody tr'))[1];
  const divertCells = Array.from(divertRow.querySelectorAll('td')).map((td) => td.textContent);
  expect(divertCells[1]).toBe('TN01BB0002');
  expect(divertCells[2]).toBe('Chengalpattu');
  expect(divertCells[3]).toBe('SalemDivert (new unloading)');
  expect(divertCells[5]).toBe('12 Sept 2026');
  expect(divertCells[6]).toBe('₹5,000.00');
  await unmount();
});

test('the month before last is one click away; older months are archived behind a month picker', async () => {
  api.getCustomerMonthlyIncome.mockImplementation((_, month) => Promise.resolve(response(month, [])));

  const { container, unmount } = await mount(<MemoryRouter><MonthlyIncomeSection customerId="c1" /></MemoryRouter>);
  expect(container.textContent).toContain('No unloadings in September 2026');
  expect(container.querySelector('#income-month')).toBeNull();

  await click(buttonByText(container, 'August 2026'));
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-08');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (August 2026)');
  expect(container.textContent).toContain('No unloadings in August 2026');

  await click(buttonByText(container, 'View archived income'));
  const picker = container.querySelector('#income-month');
  expect(picker.getAttribute('max')).toBe('2026-08');
  await setInputValue(picker, '2026-06');
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-06');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (June 2026) - Archived');

  // closing the archive returns to last month
  await click(buttonByText(container, 'Hide archived income'));
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-09');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (September 2026)');
  await unmount();
});
