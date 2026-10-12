import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import RateTable from './RateTable';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getRateTable: jest.fn(),
  updateRateTableBases: jest.fn(),
  updateRateTableCells: jest.fn(),
}));

const superAdmin = { id: 'admin-1', role: 'super_admin' };
const months = ['2025-09', '2025-10', '2025-11', '2025-12'];

function series(values, carriedFrom, exacts) {
  return Object.fromEntries(months.map((month, i) => [month, {
    value: values[i],
    carried: carriedFrom !== undefined && i >= carriedFrom,
    ...(exacts ? { exact: exacts[i] } : {}),
  }]));
}

function buildTable(id = 'tn-18mt') {
  const isKa = id === 'ka-18mt';
  return {
    id,
    title: isKa ? 'Rate/KM/Ton - KA (18MT)' : 'Rate/KM/Ton - TN (18MT)',
    startMonth: '2025-09',
    dieselState: isKa ? 'Karnataka' : 'Tamil Nadu',
    params: { baseDieselMonth: '2024-12', baseDieselPrice: isKa ? 88.94 : 92.39, kmPerLitre: 3.2, tonnage: 18 },
    months,
    dieselValues: { '2025-09': 92.45, '2025-10': 93.45, '2025-11': null, '2025-12': 92.53 },
    rows: [
      { key: 'price-1-paise', label: 'Price 1 paise', kind: 'price', base: 0, decimals: 2, values: series([0, 0.02, null, null], undefined, [0.000694, 0.018056, null, null]) },
      { key: 'price-escalation', label: 'Price Escalation', kind: 'price', base: 0, decimals: 2, values: series([0, 0.02, null, 0], undefined, [0.001042, 0.018403, null, 0.002431]) },
      { key: 'km-0-50', label: '0~50', kind: 'band', base: isKa ? 642.6849 : 598.9932, defaultBase: 598.9932, multiplier: 25, decimals: 4, values: series([598.9932, 599.4932, 599.4932, 599.4932], 2) },
      { key: 'normal-451', label: '451 Normal base', kind: 'flat', base: 3.6087, defaultBase: 3.6087, multiplier: 1, decimals: 4, values: series([3.6087, 3.6287, 3.6287, 3.6287], 2) },
    ],
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

test('renders nothing for non super admins', async () => {
  const { container, unmount } = await mount(<RateTable user={{ role: 'customer_admin' }} tableId="tn-18mt" />);
  expect(container.textContent).toBe('');
  expect(api.getRateTable).not.toHaveBeenCalled();
  await unmount();
});

test('renders KM, Base and month columns with the right precision and carried-forward styling', async () => {
  api.getRateTable.mockResolvedValue({ data: { rateTable: buildTable() } });
  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  expect(api.getRateTable).toHaveBeenCalledWith('tn-18mt');

  const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent);
  expect(headers).toEqual(['KM', 'Tender base rate', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25']);

  const rowsByLabel = Object.fromEntries(Array.from(container.querySelectorAll('tbody tr')).map((tr) => [
    tr.querySelector('th').textContent,
    Array.from(tr.querySelectorAll('td')),
  ]));
  expect(Object.keys(rowsByLabel)).toEqual(['Price 1 paise', 'Price Escalation', '0~50', '451 Normal base']);
  expect(rowsByLabel['Price 1 paise'].map((td) => td.textContent)).toEqual(['0.00', '0.00', '0.02', '-', '-']);
  expect(rowsByLabel['Price Escalation'].map((td) => td.textContent)).toEqual(['0.00', '0.00', '0.02', '-', '0.00']);
  expect(rowsByLabel['Price Escalation'][2].getAttribute('title')).toBe('Exact value 0.018403 - used by the KM and 451 rows');
  expect(rowsByLabel['Price Escalation'][3].getAttribute('title')).toContain('No Tamil Nadu diesel value');
  expect(rowsByLabel['0~50'].map((td) => td.textContent)).toEqual(['598.9932', '598.9932', '599.4932', '599.4932', '599.4932']);
  expect(rowsByLabel['0~50'][3].className).toContain('ioc-rate-carried');
  expect(rowsByLabel['0~50'][2].className).not.toContain('ioc-rate-carried');
  expect(rowsByLabel['451 Normal base'].map((td) => td.textContent)).toEqual(['3.6087', '3.6087', '3.6287', '3.6287', '3.6287']);

  expect(container.textContent).toContain('Rate/KM/Ton - TN (18MT)');
  expect(container.textContent).toContain('Tamil Nadu');
  expect(container.textContent).toContain('reference diesel Dec-24 ₹92.39');
  expect(container.textContent).toContain('Price Escalation × band midpoint (0~50 → 25');
  expect(container.textContent).not.toContain('not yet entered');
  await unmount();
});

test('when the Dec-24 diesel price is missing the table warns and Price Escalation cells explain why', async () => {
  const table = buildTable();
  table.params.baseDieselPrice = null;
  table.referenceDiesel = { '2025-09': null, '2025-10': null, '2025-11': null, '2025-12': null };
  table.rows[1].values = series([null, null, null, null]);
  api.getRateTable.mockResolvedValue({ data: { rateTable: table } });
  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  expect(container.textContent).toContain('Price Escalation needs the Tamil Nadu diesel price for Dec-24');
  expect(container.textContent).toContain('reference diesel Dec-24 not yet entered');
  const escRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('Price Escalation'));
  const escCells = Array.from(escRow.querySelectorAll('td')).slice(1);
  expect(escCells.map((td) => td.textContent)).toEqual(['-', '-', '-', '-']);
  expect(escCells[0].getAttribute('title')).toBe('No Tamil Nadu diesel value for Dec-24 - enter it in the Average Diesel Price table');
  await unmount();
});

test('the KA table loads its own configuration, title and base values', async () => {
  api.getRateTable.mockResolvedValue({ data: { rateTable: buildTable('ka-18mt') } });
  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="ka-18mt" title="Rate/KM/Ton - KA (18MT)" />);
  expect(api.getRateTable).toHaveBeenCalledWith('ka-18mt');
  expect(container.textContent).toContain('Rate/KM/Ton - KA (18MT)');
  expect(container.textContent).toContain('Karnataka');
  expect(container.textContent).toContain('88.94');
  const bandRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('0~50'));
  expect(bandRow.querySelectorAll('td')[0].textContent).toBe('642.6849');
  await unmount();
});

test('editing a base value sends only the changed bases for that table and shows the recalculated table', async () => {
  api.getRateTable.mockResolvedValue({ data: { rateTable: buildTable() } });
  const updated = buildTable();
  updated.rows[2].base = 600;
  updated.rows[2].values['2025-10'].value = 600.5; // 600 + 0.02 x 25
  api.updateRateTableBases.mockResolvedValue({ data: { rateTable: updated } });

  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  const buttons = () => Array.from(container.querySelectorAll('button'));

  await act(async () => buttons().find((b) => b.textContent === 'Edit values').click());
  expect(container.querySelector('input[aria-label="Price 1 paise base value"]')).toBeNull(); // price rows are not editable
  const input = container.querySelector('input[aria-label="0~50 base value"]');
  expect(input).not.toBeNull();
  await act(async () => setInputValue(input, '600'));
  await act(async () => buttons().find((b) => b.textContent === 'Save changes').click());

  expect(api.updateRateTableBases).toHaveBeenCalledWith('tn-18mt', { 'km-0-50': 600 });
  const bandRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('0~50'));
  const cells = Array.from(bandRow.querySelectorAll('td')).map((td) => td.textContent);
  expect(cells[0]).toBe('600.0000');
  expect(cells[2]).toBe('600.5000');
  expect(container.querySelector('input[type="number"]')).toBeNull();
  await unmount();
});

test('editing a month cell sends only that cell, blank clears a manual value, and manual cells are highlighted', async () => {
  const initial = buildTable();
  initial.rows[2].values['2025-11'] = { value: 605, carried: false, overridden: true, calculated: 599.4932 }; // already manual
  api.getRateTable.mockResolvedValue({ data: { rateTable: initial } });
  const updated = buildTable();
  updated.rows[2].values['2025-10'] = { value: 610, carried: false, overridden: true, calculated: 599.4932 };
  api.updateRateTableCells.mockResolvedValue({ data: { rateTable: updated } });

  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  const buttons = () => Array.from(container.querySelectorAll('button'));
  const bandRow = () => Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('0~50'));

  // manual cell is marked before editing
  expect(bandRow().querySelectorAll('td')[3].className).toContain('ioc-rate-overridden');

  await act(async () => buttons().find((b) => b.textContent === 'Edit values').click());
  expect(container.querySelector('input[aria-label="Price 1 paise Oct-25 value"]')).toBeNull(); // price rows stay calculated
  const oct = container.querySelector('input[aria-label="0~50 Oct-25 value"]');
  const nov = container.querySelector('input[aria-label="0~50 Nov-25 value"]');
  expect(oct.value).toBe('599.4932');
  expect(nov.value).toBe('605');
  await act(async () => setInputValue(oct, '610'));
  await act(async () => setInputValue(nov, ''));
  await act(async () => buttons().find((b) => b.textContent === 'Save changes').click());

  expect(api.updateRateTableBases).not.toHaveBeenCalled();
  expect(api.updateRateTableCells).toHaveBeenCalledWith('tn-18mt', { 'km-0-50': { '2025-10': 610, '2025-11': null } });
  const cells = Array.from(bandRow().querySelectorAll('td'));
  expect(cells[2].textContent).toBe('610.0000');
  expect(cells[2].className).toContain('ioc-rate-overridden');
  expect(cells[3].className).not.toContain('ioc-rate-overridden');
  await unmount();
});

test('shows revised Bases under the original Base, highlights the revision month and explains the Sep-28 / Sep-29 rule', async () => {
  const table = buildTable();
  const revision = { base: 619.7607, previousValue: 600.2432, fuel: 42.5998, increment: 19.5175, rate: 0.035, dieselMonth: '2025-10', dieselPrice: 98.15 };
  table.params.baseRevisions = [{ month: '2028-09', rate: 0.035 }, { month: '2029-09', rate: 0.035 }];
  table.revisions = { '2025-11': { scheduledMonth: '2028-09', rate: 0.035, dieselMonth: '2025-10', dieselPrice: 98.15 } };
  table.referenceDiesel = { '2025-09': 92.39, '2025-10': 92.39, '2025-11': 98.15, '2025-12': 98.15 };
  const band = table.rows.find((row) => row.key === 'km-0-50');
  band.averageKm = 25;
  band.currentBase = 619.7607;
  band.revisions = { '2025-11': revision };
  band.values['2025-11'] = { value: 619.7607, carried: false, overridden: false, calculated: 619.7607, revision };
  band.values['2025-12'] = { value: 620.0107, carried: false, overridden: false, calculated: 620.0107 };
  api.getRateTable.mockResolvedValue({ data: { rateTable: table } });

  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  const bandRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.querySelector('th').textContent === '0~50');
  const cells = Array.from(bandRow.querySelectorAll('td'));

  // Base column: original value, then the revised Base labelled by contract year (Sep-28 schedule → 4th year)
  expect(cells[0].textContent).toBe('598.99324th year Base rate: 619.7607');
  expect(cells[0].querySelector('.ioc-rate-revised-base').getAttribute('title')).toContain('Nov-25 - Base revised to 619.7607');
  expect(cells[0].querySelector('.ioc-rate-revised-base').getAttribute('title')).toContain('25 km ×');
  expect(cells[0].querySelector('.ioc-rate-revised-base').getAttribute('title')).toContain('3.5%');

  // Revision month cell is amber and explains R - F; later months are plain
  expect(cells[3].textContent).toBe('619.7607');
  expect(cells[3].className).toContain('ioc-rate-revised');
  expect(cells[3].className).not.toContain('ioc-rate-carried');
  expect(cells[3].getAttribute('title')).toContain('R 600.2432');
  expect(cells[3].getAttribute('title')).toContain('F 42.5998');
  expect(cells[4].className).not.toContain('ioc-rate-revised');

  // Price Escalation cells after the revision mention the new reference diesel
  const escRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.querySelector('th').textContent === 'Price Escalation');
  const escCells = Array.from(escRow.querySelectorAll('td'));
  expect(escCells[2].getAttribute('title')).toBe('Exact value 0.018403 - used by the KM and 451 rows');
  expect(escCells[4].getAttribute('title')).toBe('Against the revised reference diesel ₹98.15 (exact 0.002431)');

  // Base column stays editable (original value) in edit mode
  await act(async () => container.querySelector('button.btn').click());
  expect(bandRow.querySelector('input[aria-label="0~50 base value"]').value).toBe('598.9932');

  expect(container.textContent).toContain('Base revisions (shown in amber): 4th year Base rate on Sep-28 (3.5%) and 5th year Base rate on Sep-29 (3.5%)');
  expect(container.textContent).toContain('F = average KM × August diesel ÷ (3.2 × 18)');
  await unmount();
});
