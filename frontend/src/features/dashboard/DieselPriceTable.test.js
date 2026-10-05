import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import DieselPriceTable, { formatMonthLabel } from './DieselPriceTable';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getDieselPriceTable: jest.fn(),
  updateDieselPriceTable: jest.fn(),
  syncDieselPriceTable: jest.fn(),
}));

const superAdmin = { id: 'admin-1', role: 'super_admin' };
const rows = [
  { state: 'Andhra Pradesh', city: 'Amaravati' },
  { state: 'Karnataka', city: 'Bengaluru' },
  { state: 'Kerala', city: 'Thiruvananthapuram' },
  { state: 'Pondicherry', city: 'Puducherry' },
  { state: 'Tamil Nadu', city: 'Chennai' },
  { state: 'Telangana', city: 'Hyderabad' },
];
const states = rows.map((row) => row.state);
const months = [
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
  '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
];

function buildTable(overrides = {}) {
  return {
    startMonth: '2025-07',
    rows,
    states,
    months,
    cells: {
      'Andhra Pradesh': {},
      Karnataka: {},
      Kerala: {},
      Pondicherry: {},
      'Tamil Nadu': {
        '2026-09': { value: 100.56, source: 'daily-avg' },
        '2026-08': { value: 100.2, source: 'v3cars-state-monthly', fallback: true },
        '2025-09': { value: 94.5, source: 'manual' },
      },
      Telangana: {},
    },
    lastSyncedAt: '2026-10-03T00:00:00.000Z',
    lastSyncError: '',
    ...overrides,
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

function setInputValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
});

afterEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = false;
});

test('formatMonthLabel renders Excel-style month headers', () => {
  expect(formatMonthLabel('2026-04')).toBe('Apr-26');
  expect(formatMonthLabel('2024-12')).toBe('Dec-24');
  expect(formatMonthLabel('2027-01')).toBe('Jan-27');
});

test('renders nothing for non super admins and does not call the API', async () => {
  const { container, unmount } = await mount(<DieselPriceTable user={{ role: 'customer_admin' }} />);
  expect(container.textContent).toBe('');
  expect(api.getDieselPriceTable).not.toHaveBeenCalled();
  await unmount();
});

test('renders every month from Jul 2025 in a horizontal scroller sized to show 12 months', async () => {
  api.getDieselPriceTable.mockResolvedValue({ data: { dieselPriceTable: buildTable() } });
  const { container, unmount } = await mount(<DieselPriceTable user={superAdmin} />);

  const headers = Array.from(container.querySelectorAll('thead tr:nth-child(2) th')).map((th) => th.textContent);
  expect(headers[0]).toBe('State (city)');
  expect(headers.slice(1)).toEqual(months.map(formatMonthLabel));
  expect(headers).toContain('Jul-25');
  expect(headers).not.toContain('Jun-25');
  expect(headers).toContain('Oct-26');

  const rowLabels = Array.from(container.querySelectorAll('tbody th')).map((th) => th.textContent);
  expect(rowLabels).toEqual(rows.map(({ state, city }) => `${state}${city}`));
  expect(rowLabels).toContain('TelanganaHyderabad');
  expect(container.querySelectorAll('tbody tr')).toHaveLength(6);

  const scroller = container.querySelector('[data-testid="diesel-price-scroll"]');
  expect(scroller).not.toBeNull();
  const table = scroller.querySelector('table');
  // 23 months / 12 visible -> table is ~192% of the scroller width, so older months overflow to the left.
  expect(table.style.width).toContain(`${(months.length / 12) * 100}%`);

  const tnRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('Tamil Nadu'));
  const tnCells = Array.from(tnRow.querySelectorAll('td'));
  expect(tnCells[months.indexOf('2026-09')].textContent).toBe('100.56');
  expect(tnCells[months.indexOf('2025-09')].textContent).toBe('94.50');
  expect(tnCells[months.indexOf('2025-09')].className).toContain('diesel-price-manual');
  expect(tnCells[months.indexOf('2026-08')].textContent).toBe('100.20');
  expect(tnCells[months.indexOf('2026-08')].className).toContain('diesel-price-fallback');
  expect(tnCells[months.indexOf('2026-08')].getAttribute('title')).toContain('state-level price used');
  expect(tnCells[months.indexOf('2026-07')].textContent).toBe('');

  await unmount();
});

test('editing a cell sends only the changed cells and shows the saved table', async () => {
  api.getDieselPriceTable.mockResolvedValue({ data: { dieselPriceTable: buildTable() } });
  const saved = buildTable();
  saved.cells.Kerala['2025-10'] = { value: 92.3, source: 'manual' };
  api.updateDieselPriceTable.mockResolvedValue({ data: { dieselPriceTable: saved } });

  const { container, unmount } = await mount(<DieselPriceTable user={superAdmin} />);
  const buttons = () => Array.from(container.querySelectorAll('button'));

  await act(async () => buttons().find((b) => b.textContent === 'Edit').click());
  const input = container.querySelector('input[aria-label="Kerala Oct-25 average diesel price"]');
  expect(input).not.toBeNull();
  await act(async () => setInputValue(input, '92.3'));
  await act(async () => buttons().find((b) => b.textContent === 'Save changes').click());

  expect(api.updateDieselPriceTable).toHaveBeenCalledWith({ Kerala: { '2025-10': 92.3 } });
  const keralaRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('Kerala'));
  expect(keralaRow.querySelectorAll('td')[months.indexOf('2025-10')].textContent).toBe('92.30');
  expect(container.querySelector('input[type="number"]')).toBeNull();

  await unmount();
});

test('refresh button pulls fresh prices from the sources', async () => {
  api.getDieselPriceTable.mockResolvedValue({ data: { dieselPriceTable: buildTable() } });
  const refreshed = buildTable();
  refreshed.cells.Karnataka['2026-10'] = { value: 99.24, source: 'daily-avg' };
  api.syncDieselPriceTable.mockResolvedValue({ data: { dieselPriceTable: refreshed } });

  const { container, unmount } = await mount(<DieselPriceTable user={superAdmin} />);
  const refresh = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Refresh prices');
  await act(async () => refresh.click());

  expect(api.syncDieselPriceTable).toHaveBeenCalledTimes(1);
  const kaRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('Karnataka'));
  expect(kaRow.querySelectorAll('td')[months.indexOf('2026-10')].textContent).toBe('99.24');

  await unmount();
});
