import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import RateTables from './RateTables';
import * as api from '../../api/api';

jest.mock('../../api/api', () => ({
  listRateTables: jest.fn(),
  recalculateRateTables: jest.fn(),
  getRateTable: jest.fn(),
  updateRateTableBases: jest.fn(),
  updateRateTableCells: jest.fn(),
}));

const superAdmin = { id: 'admin-1', role: 'super_admin' };
const months = ['2025-09', '2025-10'];

function cells(values, overriddenMonths = []) {
  return Object.fromEntries(months.map((month, i) => [month, {
    value: values[i],
    carried: false,
    overridden: overriddenMonths.includes(month),
    calculated: values[i],
  }]));
}

function buildTable(id, title, { manual = false } = {}) {
  return {
    id,
    title,
    startMonth: '2025-09',
    dieselState: 'Tamil Nadu',
    params: { baseDieselMonth: '2024-12', baseDieselPrice: 92.39, kmPerLitre: 3.2, tonnage: 18 },
    months,
    dieselValues: { '2025-09': 92.45, '2025-10': 93.45 },
    rows: [
      { key: 'price-1-paise', label: 'Price 1 paise', kind: 'price', base: 0, decimals: 2, values: cells([0, 0.02]) },
      { key: 'km-0-50', label: '0~50', kind: 'band', base: 598.9932, defaultBase: 598.9932, multiplier: 25, decimals: 4, values: manual ? cells([610, 610], ['2025-09']) : cells([598.9932, 599.4932]) },
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

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.clearAllMocks();
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = false;
});

test('renders nothing for non super admins', async () => {
  const { container, unmount } = await mount(<RateTables user={{ role: 'customer_admin' }} />);
  expect(container.textContent).toBe('');
  expect(api.listRateTables).not.toHaveBeenCalled();
  await unmount();
});

test('"Recalculate all tables" confirms, clears manual values on the server and shows the recalculated tables', async () => {
  api.listRateTables.mockResolvedValue({ data: { rateTables: [
    buildTable('tn-18mt', 'Rate/KM/Ton - TN (18MT)', { manual: true }),
    buildTable('ka-18mt', 'Rate/KM/Ton - KA (18MT)'),
  ] } });
  api.recalculateRateTables.mockResolvedValue({ data: { rateTables: [
    buildTable('tn-18mt', 'Rate/KM/Ton - TN (18MT)'),
    buildTable('ka-18mt', 'Rate/KM/Ton - KA (18MT)'),
  ] } });
  const { container, unmount } = await mount(<RateTables user={superAdmin} />);

  expect(container.textContent).toContain('Rate/KM/Ton - TN (18MT)');
  expect(container.textContent).toContain('Rate/KM/Ton - KA (18MT)');
  const tn = container.querySelector('[data-testid="rate-table-tn-18mt"]');
  expect(tn.querySelectorAll('td.ioc-rate-overridden')).toHaveLength(1);
  expect(tn.textContent).toContain('610.0000');

  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Recalculate all tables');
  expect(button).toBeTruthy();
  expect(button.title).toContain('1 manually entered month value(s) will be cleared');

  await act(async () => button.click());
  await act(async () => {});

  expect(window.confirm).toHaveBeenCalledTimes(1);
  expect(window.confirm.mock.calls[0][0]).toContain('clears 1 manually entered month value(s)');
  expect(api.recalculateRateTables).toHaveBeenCalledTimes(1);
  const tnAfter = container.querySelector('[data-testid="rate-table-tn-18mt"]');
  expect(tnAfter.querySelectorAll('td.ioc-rate-overridden')).toHaveLength(0);
  expect(tnAfter.textContent).not.toContain('610.0000');
  expect(tnAfter.textContent).toContain('599.4932');
  expect(container.textContent).toContain('All Rate/KM/Ton tables recalculated from the diesel prices.');
  await unmount();
});

test('cancelling the confirmation leaves the tables untouched and a server error is shown', async () => {
  api.listRateTables.mockResolvedValue({ data: { rateTables: [buildTable('tn-18mt', 'Rate/KM/Ton - TN (18MT)', { manual: true })] } });
  const { container, unmount } = await mount(<RateTables user={superAdmin} />);
  const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Recalculate all tables');

  window.confirm.mockReturnValueOnce(false);
  await act(async () => button.click());
  expect(api.recalculateRateTables).not.toHaveBeenCalled();
  expect(container.textContent).toContain('610.0000');

  api.recalculateRateTables.mockRejectedValue({ response: { data: { error: 'Database unavailable' } } });
  await act(async () => button.click());
  await act(async () => {});
  expect(api.recalculateRateTables).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Database unavailable');
  expect(container.textContent).toContain('610.0000');
  await unmount();
});
