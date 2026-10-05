import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import RateTable from './RateTable';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  getRateTable: jest.fn(),
  updateRateTableBases: jest.fn(),
}));

const superAdmin = { id: 'admin-1', role: 'super_admin' };
const months = ['2025-09', '2025-10', '2025-11', '2025-12'];

function series(values, carriedFrom) {
  return Object.fromEntries(months.map((month, i) => [month, { value: values[i], carried: carriedFrom !== undefined && i >= carriedFrom }]));
}

function buildTable(id = 'tn-18mt') {
  const isKa = id === 'ka-18mt';
  return {
    id,
    title: isKa ? 'Rate/KM/Ton - KA (18MT)' : 'Rate/KM/Ton - TN (18MT)',
    startMonth: '2025-09',
    dieselState: isKa ? 'Karnataka' : 'Tamil Nadu',
    params: { baseDieselPrice: isKa ? 88.94 : 92.39, kmPerLitre: 3.2, tonnage: 18 },
    months,
    dieselValues: { '2025-09': 92.45, '2025-10': 93.45, '2025-11': null, '2025-12': 92.53 },
    rows: [
      { key: 'price-1-paise', label: 'Price 1 paise', kind: 'price', base: 0, decimals: 2, values: series([0, 0.02, null, null]) },
      { key: 'price-escalation', label: 'Price Escalation', kind: 'price', base: 0, decimals: 2, values: series([0, 0.02, null, 0]) },
      { key: 'km-0-50', label: '0~50', kind: 'band', base: isKa ? 642.6849 : 598.9932, defaultBase: 598.9932, multiplier: 12.5, decimals: 4, values: series([598.9932, 599.2432, 599.2432, 599.2432], 2) },
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
  expect(headers).toEqual(['KM', 'Base', 'Sep-25', 'Oct-25', 'Nov-25', 'Dec-25']);

  const rowsByLabel = Object.fromEntries(Array.from(container.querySelectorAll('tbody tr')).map((tr) => [
    tr.querySelector('th').textContent,
    Array.from(tr.querySelectorAll('td')),
  ]));
  expect(Object.keys(rowsByLabel)).toEqual(['Price 1 paise', 'Price Escalation', '0~50', '451 Normal base']);
  expect(rowsByLabel['Price 1 paise'].map((td) => td.textContent)).toEqual(['0.00', '0.00', '0.02', '-', '-']);
  expect(rowsByLabel['Price Escalation'].map((td) => td.textContent)).toEqual(['0.00', '0.00', '0.02', '-', '0.00']);
  expect(rowsByLabel['0~50'].map((td) => td.textContent)).toEqual(['598.9932', '598.9932', '599.2432', '599.2432', '599.2432']);
  expect(rowsByLabel['0~50'][3].className).toContain('ioc-rate-carried');
  expect(rowsByLabel['0~50'][2].className).not.toContain('ioc-rate-carried');
  expect(rowsByLabel['451 Normal base'].map((td) => td.textContent)).toEqual(['3.6087', '3.6087', '3.6287', '3.6287', '3.6287']);

  expect(container.textContent).toContain('Rate/KM/Ton - TN (18MT)');
  expect(container.textContent).toContain('Tamil Nadu');
  expect(container.textContent).toContain('92.39');
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
  updated.rows[2].values['2025-10'].value = 600.25;
  api.updateRateTableBases.mockResolvedValue({ data: { rateTable: updated } });

  const { container, unmount } = await mount(<RateTable user={superAdmin} tableId="tn-18mt" />);
  const buttons = () => Array.from(container.querySelectorAll('button'));

  await act(async () => buttons().find((b) => b.textContent === 'Edit base values').click());
  expect(container.querySelector('input[aria-label="Price 1 paise base value"]')).toBeNull(); // price rows are not editable
  const input = container.querySelector('input[aria-label="0~50 base value"]');
  expect(input).not.toBeNull();
  await act(async () => setInputValue(input, '600'));
  await act(async () => buttons().find((b) => b.textContent === 'Save changes').click());

  expect(api.updateRateTableBases).toHaveBeenCalledWith('tn-18mt', { 'km-0-50': 600 });
  const bandRow = Array.from(container.querySelectorAll('tbody tr')).find((tr) => tr.textContent.startsWith('0~50'));
  const cells = Array.from(bandRow.querySelectorAll('td')).map((td) => td.textContent);
  expect(cells[0]).toBe('600.0000');
  expect(cells[2]).toBe('600.2500');
  expect(container.querySelector('input[type="number"]')).toBeNull();
  await unmount();
});
