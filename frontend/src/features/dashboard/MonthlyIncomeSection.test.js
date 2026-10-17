import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MonthlyIncomeSection from './MonthlyIncomeSection';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getCustomerMonthlyIncome: jest.fn(),
}));

const rates = { tds: 0.02, diesel: 0.4, amount: 0.6, shortagePerKg: 5 };
const row = (overrides) => ({
  sNo: 1,
  tripId: 't1',
  vehicleNumber: 'KA01AA0001',
  vehicleCorporation: 'IOC',
  cutoffDay: 0,
  loadingLocation: 'AEGIS, Mangalore',
  unloadingLocation: 'Belgaum',
  leg: 'load',
  month: '2026-09',
  loadingDate: '2026-09-05T03:00:00Z',
  unloadingDate: '2026-09-07T03:00:00Z',
  status: 'closed',
  corporation: 'IOC-KA',
  tripIncome: 10000,
  shortage: null,
  tds: 200,
  diesel: 3920,
  amount: 5880,
  notes: [],
  ...overrides,
});

function response(month, groups) {
  const all = groups.flatMap((g) => g.periods.flatMap((p) => p.states.flatMap((s) => s.rows)));
  const sum = (key) => all.reduce((s, r) => s + (r[key] || 0), 0);
  return {
    data: {
      month,
      rates,
      cutoffDays: { BPC: 5 },
      groups,
      totals: { trips: all.length, pricedTrips: all.filter((r) => r.tripIncome != null).length, tripIncome: sum('tripIncome'), shortage: sum('shortage'), tds: sum('tds'), diesel: sum('diesel'), amount: sum('amount') },
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

test('shows last month by default, split by vehicle corporation then route state, with the TDS / Diesel / Amount split', async () => {
  const kaState = { state: 'KA', known: true, corporations: ['IOC-KA'], rows: [row({ shortage: 100, amount: 5780 })], totals: { trips: 1, pricedTrips: 1, tripIncome: 10000.7, shortage: 100.4, tds: 200.5, diesel: 3920.6, amount: 5780.1 } };
  const tnState = { state: 'TN', known: true, corporations: ['IOC-TN'], rows: [
    row({ tripId: 't2', vehicleNumber: 'TN01BB0001', corporation: 'IOC-TN', state: 'TN', tripIncome: null, tds: null, diesel: null, amount: null, status: 'open', notes: ['Loading weight (tons) is required to calculate Trip Income.'] }),
    row({ sNo: 2, tripId: 't3', leg: 'divert', vehicleNumber: 'TN01BB0002', corporation: 'IOC-TN', state: 'TN', loadingLocation: 'Chengalpattu', unloadingLocation: 'Salem', unloadingDate: '2026-09-12T03:00:00Z', tripIncome: 5000, tds: 100, diesel: 1960, amount: 2940 }),
  ], totals: { trips: 2, pricedTrips: 1, tripIncome: 5000, tds: 100, diesel: 1960, amount: 2940 } };
  const bpcState = { state: 'TN', known: true, corporations: ['BPC-TN'], rows: [row({ tripId: 't4', vehicleNumber: 'TN02CC0001', vehicleCorporation: 'BPC', cutoffDay: 5, corporation: 'BPC-TN', state: 'TN', unloadingDate: '2026-10-03T03:00:00Z', tripIncome: 7000, tds: 140, diesel: 2744, amount: 4116 })], totals: { trips: 1, pricedTrips: 1, tripIncome: 7000, tds: 140, diesel: 2744, amount: 4116 } };
  const iocTotals = { trips: 3, pricedTrips: 2, tripIncome: 15000, tds: 300, diesel: 5880, amount: 8720 };
  const empty = { trips: 0, pricedTrips: 0, tripIncome: 0, tds: 0, diesel: 0, amount: 0 };
  api.getCustomerMonthlyIncome.mockResolvedValue(response('2026-09', [
    { vehicleCorporation: 'BPC', known: true, cutoffDay: 5, halfMonth: false, periods: [{ key: 'month', label: '6 - 5 (next month)', from: '2026-09-06', to: '2026-10-05', states: [bpcState], totals: bpcState.totals }], totals: bpcState.totals },
    { vehicleCorporation: 'IOC', known: true, cutoffDay: 0, halfMonth: true, periods: [
      { key: 'first-half', label: '1 - 15', from: '2026-09-01', to: '2026-09-15', states: [kaState, tnState], totals: iocTotals },
      { key: 'second-half', label: '16 - 30', from: '2026-09-16', to: '2026-09-30', states: [], totals: empty },
    ], totals: iocTotals },
  ]));

  const { container, unmount } = await mount(<MemoryRouter><MonthlyIncomeSection customerId="c1" /></MemoryRouter>);

  expect(api.getCustomerMonthlyIncome).toHaveBeenCalledWith('c1', '2026-09');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (September 2026)');

  // main split by vehicle corporation (BPC first alphabetically), sub split by route state
  const corporations = Array.from(container.querySelectorAll('[data-testid^="income-corporation-"]'));
  expect(corporations.map((el) => el.getAttribute('data-testid'))).toEqual(['income-corporation-BPC', 'income-corporation-IOC']);
  expect(corporations[0].querySelector('h4').textContent).toContain('BPC');
  expect(corporations[0].querySelector('h4').textContent).toContain('up to the 5th of the next month');
  expect(corporations[1].querySelector('h4').textContent).toContain('calendar month');
  expect(corporations[1].querySelector('h4').textContent).toContain('billed per half month');
  // IOC / HPC: one block per half month, both always shown; BPC: a single block
  const periods = Array.from(container.querySelectorAll('[data-testid^="income-period-"]')).map((el) => el.getAttribute('data-testid'));
  expect(periods).toEqual(['income-period-BPC-month', 'income-period-IOC-first-half', 'income-period-IOC-second-half']);
  const firstHalf = container.querySelector('[data-testid="income-period-IOC-first-half"]');
  const secondHalf = container.querySelector('[data-testid="income-period-IOC-second-half"]');
  expect(firstHalf.querySelector('h5').textContent).toContain('IOC - 1 - 15 September 2026');
  expect(secondHalf.querySelector('h5').textContent).toContain('IOC - 16 - 30 September 2026');
  expect(secondHalf.textContent).toContain('No unloadings in this period.');
  expect(firstHalf.textContent).toContain('Total IOC - 1 - 15 September 2026'); // two states -> period sub-total
  expect(firstHalf.textContent).toContain('Trip Income 15,000');
  expect(firstHalf.textContent).toContain('TDS 300');
  expect(firstHalf.textContent).toContain('Diesel 5,880');
  expect(firstHalf.textContent).toContain('Amount 8,720');
  expect(firstHalf.textContent).not.toContain('TDS ₹');
  const bpc = container.querySelector('[data-testid="income-group-BPC-month-TN"]');
  const ka = container.querySelector('[data-testid="income-group-IOC-first-half-KA"]');
  const tn = container.querySelector('[data-testid="income-group-IOC-first-half-TN"]');
  expect(bpc).not.toBeNull();
  expect(ka).not.toBeNull();
  expect(tn).not.toBeNull();
  expect(ka.querySelector('h6').textContent).toContain('KA (IOC-KA routes)');
  expect(bpc.textContent).toContain('03 Oct 2026'); // BPC cut-off pulls an October unloading into September
  // IOC has two periods -> an IOC month total; the page also has a grand total
  expect(corporations[1].textContent).toContain('Total IOC - September 2026');
  expect(container.textContent).toContain('Total - all corporations');

  const headers = Array.from(ka.querySelectorAll('thead th')).map((th) => th.textContent);
  expect(headers).toEqual([
    'S.No', 'Vehicle Number', 'Loading location', 'Unloading location', 'Loading date', 'Unloading date', 'Trip Income',
    'Shortage', 'TDS', 'Diesel', 'Amount',
  ]);
  expect(ka.querySelector('thead').textContent).not.toMatch(/loss above 40|trip income x|\(trip income - tds\)/i);
  const kaRows = Array.from(ka.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent));
  expect(kaRows[0]).toEqual(['1', 'KA01AA0001', 'AEGIS, Mangalore', 'Belgaum', '05 Sept 2026', '07 Sept 2026', '10,000.00', '₹100.00', '₹200.00', '₹3,920.00', '₹5,780.00']);
  expect(kaRows[1]).toEqual(['Total KA', '10,001', '₹100', '201', '3,921', '5,780']);
  expect(kaRows[1][0]).not.toContain('₹');
  expect(ka.querySelector('tbody tr td a').getAttribute('href')).toBe('/trips/t1');
  expect(ka.querySelector('tbody tr td:nth-child(2)').textContent).not.toContain('IOC');

  expect(tn.textContent).toContain('NA');
  expect(tn.textContent).toContain('Loading weight (tons) is required');
  expect(tn.textContent).toContain('1 unloading(s) without income not included');
  const divertRow = Array.from(tn.querySelectorAll('tbody tr'))[1];
  const divertCells = Array.from(divertRow.querySelectorAll('td')).map((td) => td.textContent);
  expect(divertCells[1]).toBe('TN01BB0002');
  expect(divertCells[2]).toBe('Chengalpattu');
  expect(divertCells[3]).toBe('SalemDivert (new unloading)');
  expect(divertCells[5]).toBe('12 Sept 2026');
  expect(divertCells[6]).toBe('5,000.00');
  const openRow = Array.from(tn.querySelectorAll('tbody tr')).find((tr) => tr.textContent.includes('TN01BB0001'));
  expect(openRow.querySelector('td:nth-child(2)').textContent).toContain('Open');
  await unmount();
});

test('the three most recent completed months are one click away; older months are archived behind a month picker', async () => {
  api.getCustomerMonthlyIncome.mockImplementation((_, month) => Promise.resolve(response(month, [])));

  const { container, unmount } = await mount(<MemoryRouter><MonthlyIncomeSection customerId="c1" /></MemoryRouter>);
  expect(container.textContent).toContain('No unloadings in September 2026');
  expect(container.querySelector('#income-month')).toBeNull();

  await click(buttonByText(container, 'August 2026'));
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-08');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (August 2026)');
  expect(container.textContent).toContain('No unloadings in August 2026');

  await click(buttonByText(container, 'July 2026'));
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-07');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (July 2026)');
  expect(container.textContent).toContain('No unloadings in July 2026');

  await click(buttonByText(container, 'View archived income'));
  const picker = container.querySelector('#income-month');
  expect(picker.getAttribute('max')).toBe('2026-07');
  await setInputValue(picker, '2026-06');
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-06');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (June 2026) - Archived');

  // closing the archive returns to last month
  await click(buttonByText(container, 'Hide archived income'));
  expect(api.getCustomerMonthlyIncome).toHaveBeenLastCalledWith('c1', '2026-09');
  expect(container.querySelector('h3').textContent).toBe('Monthly Income (September 2026)');
  await unmount();
});
