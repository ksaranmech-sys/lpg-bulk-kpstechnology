const test = require('node:test');
const assert = require('node:assert/strict');

const dieselPrices = require('../src/utils/dieselPrices');
const { DIESEL_PRICE_ROWS, DIESEL_PRICE_START_MONTH } = require('../src/config/constants');

const { SOURCES, LEVELS } = dieselPrices;
const STATES = DIESEL_PRICE_ROWS.map((row) => row.state);
// The Dec-24 column is pre-filled with each state's configured base diesel price.
const BASE = Object.fromEntries(DIESEL_PRICE_ROWS.map(({ state, baseDieselPrice }) => [state, { '2024-12': { value: baseDieselPrice, source: 'base' } }]));

test('table rows are one reference city per state, including Telangana / Hyderabad, each with its Dec-24 base diesel price', () => {
  assert.deepEqual(DIESEL_PRICE_ROWS.map(({ state, city, baseDieselPrice }) => `${state}:${city}:${baseDieselPrice}`), [
    'Andhra Pradesh:Amaravati:95.69',
    'Karnataka:Bengaluru:91.14',
    'Kerala:Thiruvananthapuram:96.16',
    'Pondicherry:Puducherry:84.48',
    'Tamil Nadu:Chennai:92.41',
    'Telangana:Hyderabad:92.44',
  ]);
});

test('monthRange runs from the start month to the end month inclusive, crossing years', () => {
  assert.deepEqual(dieselPrices.monthRange('2024-11', '2025-02'), ['2024-11', '2024-12', '2025-01', '2025-02']);
  assert.deepEqual(dieselPrices.monthRange('2025-03', '2025-03'), ['2025-03']);
  assert.deepEqual(dieselPrices.monthRange('2025-04', '2025-03'), []);
  assert.deepEqual(dieselPrices.monthRange('bad', '2025-03'), []);
});

test('istDayKey converts timestamps to the Indian calendar date', () => {
  assert.equal(dieselPrices.istDayKey('2026-10-02T07:28:41+00:00'), '2026-10-02');
  assert.equal(dieselPrices.istDayKey('2026-10-02T20:00:00Z'), '2026-10-03'); // 01:30 IST next day
  assert.equal(dieselPrices.istDayKey('garbage'), null);
});

test('averageDailyByMonth uses only city days when any exist, otherwise falls back to state days', () => {
  const daily = {
    '2026-09-29': { value: 100.5, level: 'city' },
    '2026-09-30': { value: '100.58', level: 'city' },
    '2026-10-01': { value: 100.57, level: 'city' },
    '2026-10-02': { value: 150, level: 'state' }, // ignored: the city has a price this month
    '2026-10-03': { value: null, level: 'city' },
    '2026-08-01': { value: 101.0, level: 'state' }, // no city price in August -> state used
    '2026-08-02': { value: 101.2, level: 'state' },
    'not-a-date': { value: 5, level: 'city' },
  };
  assert.deepEqual(dieselPrices.averageDailyByMonth(daily), {
    '2026-08': { value: 101.1, days: 2, stateDays: 2 },
    '2026-09': { value: 100.54, days: 2, stateDays: 0 },
    '2026-10': { value: 100.57, days: 1, stateDays: 0 },
  });
});

test('averageDistrictMonths takes the mean of district monthly averages, skipping empty districts', () => {
  const districts = [
    [{ month: '2026-08', avgPrice: 100 }, { month: '2026-07', avgPrice: 99 }],
    [{ month: '2026-08', avgPrice: 102 }, { month: '2026-07', avgPrice: null }],
    [],
  ];
  assert.deepEqual(dieselPrices.averageDistrictMonths(districts), { '2026-08': 101, '2026-07': 99 });
});

test('normalizeTable builds the default shape, keeps manual cells and drops legacy/unknown sources', () => {
  const table = dieselPrices.normalizeTable({
    startMonth: '2023-01', // saved by an earlier version - config wins
    cells: {
      'Tamil Nadu': {
        '2026-01': { value: '100.5', source: 'daily-avg', fallback: true },
        '2024-11': { value: 90, source: 'manual' }, // before the start month
        '2026-02': { value: 'abc', source: 'manual' },
        '2026-03': { value: 95, source: 'state-history' }, // legacy source -> recalculated
        '2026-04': { value: 96, source: 'manual', fallback: 'yes' },
      },
      'Not A State': { '2026-01': { value: 1, source: 'manual' } },
    },
    daily: { Kerala: { '2026-09-01': 103.1, '2026-09-02': { value: 103.2, level: 'state' }, '2024-11-30': 90, bad: 1 } },
  });
  assert.equal(table.startMonth, DIESEL_PRICE_START_MONTH);
  assert.equal(table.startMonth, '2024-12');
  assert.deepEqual(table.rows.map((row) => row.state), STATES);
  assert.deepEqual(table.cells['Tamil Nadu'], {
    ...BASE['Tamil Nadu'],
    '2026-01': { value: 100.5, source: 'daily-avg', fallback: true },
    '2026-04': { value: 96, source: 'manual' },
  });
  assert.deepEqual(table.cells.Telangana, BASE.Telangana);
  assert.equal(table.cells['Not A State'], undefined);
  // bare numbers from the previous storage format are treated as city-level prices
  assert.deepEqual(table.daily.Kerala, {
    '2026-09-01': { value: 103.1, level: 'city' },
    '2026-09-02': { value: 103.2, level: 'state' },
  });
});

test('the Dec-24 base price always comes from config: a stored base cell is ignored, a manual or synced value replaces it, clearing restores it', () => {
  const stored = dieselPrices.normalizeTable({ cells: { Kerala: { '2024-12': { value: 50, source: 'base' } } } });
  assert.deepEqual(stored.cells.Kerala, { '2024-12': { value: 96.16, source: SOURCES.BASE } });
  assert.deepEqual(dieselPrices.emptyTable().cells, BASE);

  const manual = dieselPrices.applyManualEdits(stored, { Kerala: { '2024-12': 97 } });
  assert.deepEqual(manual.cells.Kerala, { '2024-12': { value: 97, source: SOURCES.MANUAL } });
  const cleared = dieselPrices.applyManualEdits(manual, { Kerala: { '2024-12': '' } });
  assert.deepEqual(cleared.cells.Kerala, { '2024-12': { value: 96.16, source: SOURCES.BASE } });

  const synced = dieselPrices.mergeSyncedCells(stored, { Kerala: { '2024-12': { value: 95.1, source: SOURCES.STATE_MONTHLY, fallback: true } } }, { now: new Date('2026-10-03T00:00:00Z') });
  assert.deepEqual(synced.cells.Kerala, { '2024-12': { value: 95.1, source: SOURCES.STATE_MONTHLY, fallback: true } });

  const presented = dieselPrices.presentTable(stored, { now: new Date('2025-01-10T00:00:00Z') });
  assert.deepEqual(presented.cells['Tamil Nadu'], { '2024-12': { value: 92.41, source: SOURCES.BASE } });
});

test('recordDailyPrices: city beats state, primary beats backfill within a level, future/old days ignored', () => {
  const now = new Date('2026-10-03T06:00:00Z');
  const table = dieselPrices.emptyTable();
  // backfill state prices first
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-09-30': 103.0, '2026-10-01': 103.1, '2026-10-02': 103.2 }, { level: LEVELS.STATE, now });
  // primary state price overwrites the backfill state price
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-10-02': 103.3 }, { level: LEVELS.STATE, overwrite: true, now });
  // backfill city price replaces any state price but never another city price
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-10-01': 104.1, '2026-10-09': 1, '2024-11-30': 1 }, { level: LEVELS.CITY, now });
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-10-01': 999 }, { level: LEVELS.CITY, now });
  // primary city price overwrites backfill city price
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-10-01': 104.4 }, { level: LEVELS.CITY, overwrite: true, now });
  // a later state price never replaces a city price
  dieselPrices.recordDailyPrices(table, 'Kerala', { '2026-10-01': 50 }, { level: LEVELS.STATE, overwrite: true, now });

  assert.deepEqual(table.daily.Kerala, {
    '2026-09-30': { value: 103.0, level: 'state' },
    '2026-10-01': { value: 104.4, level: 'city' },
    '2026-10-02': { value: 103.3, level: 'state' },
  });
  dieselPrices.recordDailyPrices(table, 'Goa', { '2026-10-01': 1 }, { level: LEVELS.CITY, now });
  assert.equal(table.daily.Goa, undefined);
});

test('mergeSyncedCells keeps manual edits and never downgrades a better source', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  const existing = dieselPrices.normalizeTable({
    cells: {
      Karnataka: {
        '2026-08': { value: 98, source: SOURCES.MANUAL },
        '2026-07': { value: 99.5, source: SOURCES.DAILY_AVG },
        '2026-06': { value: 97, source: SOURCES.CITY_MONTHLY },
        '2026-04': { value: 96, source: SOURCES.STATE_MONTHLY, fallback: true },
      },
    },
  });
  const synced = {
    Karnataka: {
      '2026-08': { value: 99.1, source: SOURCES.DAILY_AVG }, // manual wins
      '2026-07': { value: 98.7, source: SOURCES.CITY_MONTHLY }, // worse source loses
      '2026-06': { value: 97.4, source: SOURCES.CITY_MONTHLY }, // same source refreshes
      '2026-04': { value: 96.5, source: SOURCES.CITY_MONTHLY }, // city monthly replaces state monthly
      '2026-09': { value: 99.2, source: SOURCES.DAILY_AVG, fallback: true }, // new month fills
      '2026-11': { value: 1, source: SOURCES.DAILY_AVG }, // future month ignored
      '2024-11': { value: 1, source: SOURCES.DAILY_AVG }, // before start ignored
      '2026-05': { value: 1, source: SOURCES.MANUAL }, // sync can never create manual cells
    },
  };
  const merged = dieselPrices.mergeSyncedCells(existing, synced, { now });
  assert.deepEqual(merged.cells.Karnataka, {
    ...BASE.Karnataka,
    '2026-08': { value: 98, source: SOURCES.MANUAL },
    '2026-07': { value: 99.5, source: SOURCES.DAILY_AVG },
    '2026-06': { value: 97.4, source: SOURCES.CITY_MONTHLY },
    '2026-04': { value: 96.5, source: SOURCES.CITY_MONTHLY },
    '2026-09': { value: 99.2, source: SOURCES.DAILY_AVG, fallback: true },
  });
});

test('recalculateFromDaily: daily average > city monthly > state monthly, flagging state-based values', () => {
  const now = new Date('2026-10-03T00:00:00Z');
  const table = dieselPrices.emptyTable();
  table.daily.Telangana = {
    '2026-10-01': { value: 104.2, level: 'city' },
    '2026-10-02': { value: 150, level: 'state' }, // ignored: city has a price in October
    '2026-09-15': { value: 104.0, level: 'city' },
    '2026-06-10': { value: 103.0, level: 'state' }, // only state prices in June -> fallback
  };
  const next = dieselPrices.recalculateFromDaily(table, {
    Telangana: {
      city: { '2026-10': 110, '2026-09': 110, '2026-08': 103.9 },
      state: { '2026-08': 120, '2026-07': 103.5, '2026-06': 120 },
    },
  }, { now });
  assert.deepEqual(next.cells.Telangana, {
    ...BASE.Telangana,
    '2026-10': { value: 104.2, source: SOURCES.DAILY_AVG },
    '2026-09': { value: 104.0, source: SOURCES.DAILY_AVG },
    '2026-08': { value: 103.9, source: SOURCES.CITY_MONTHLY },
    '2026-07': { value: 103.5, source: SOURCES.STATE_MONTHLY, fallback: true },
    '2026-06': { value: 103.0, source: SOURCES.DAILY_AVG, fallback: true },
  });
});

test('applyManualEdits pins values as manual, clears cells on empty, and validates input', () => {
  const base = dieselPrices.normalizeTable({
    cells: { Kerala: { '2026-01': { value: 101, source: SOURCES.DAILY_AVG } } },
  });
  const edited = dieselPrices.applyManualEdits(base, {
    Kerala: { '2026-01': '', '2025-08': '96.456' },
    Telangana: { '2026-02': 93 },
  });
  assert.deepEqual(edited.cells.Kerala, { ...BASE.Kerala, '2025-08': { value: 96.46, source: SOURCES.MANUAL } });
  assert.deepEqual(edited.cells.Telangana, { ...BASE.Telangana, '2026-02': { value: 93, source: SOURCES.MANUAL } });

  assert.throws(() => dieselPrices.applyManualEdits(base, { Goa: { '2026-01': 1 } }), /Unknown state/);
  assert.throws(() => dieselPrices.applyManualEdits(base, { Kerala: { '2026-13': 1 } }), /Invalid month/);
  assert.throws(() => dieselPrices.applyManualEdits(base, { Kerala: { '2024-11': 1 } }), /Invalid month/);
  assert.throws(() => dieselPrices.applyManualEdits(base, { Kerala: { '2026-01': -2 } }), /Invalid price/);
  assert.throws(() => dieselPrices.applyManualEdits(base, { Kerala: { '2026-01': 'abc' } }), /Invalid price/);
  assert.throws(() => dieselPrices.applyManualEdits(base, []), /keyed by state/);
});

test('presentTable adds rows, states and the month axis but not raw daily prices', () => {
  const table = dieselPrices.emptyTable();
  table.daily.Kerala['2025-09-01'] = { value: 90, level: 'city' };
  const presented = dieselPrices.presentTable(table, { now: new Date('2025-09-10T00:00:00Z') });
  assert.deepEqual(presented.months, [
    '2024-12', '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09',
  ]);
  assert.deepEqual(presented.states, STATES);
  assert.deepEqual(presented.rows[5], { state: 'Telangana', city: 'Hyderabad' });
  assert.equal(presented.daily, undefined);
});

test('a new month column appears automatically at the start of every month (India time)', () => {
  const table = dieselPrices.emptyTable();
  // 31 Oct 2026 23:00 IST (17:30 UTC) is still October in India...
  const endOfOctober = dieselPrices.presentTable(table, { now: new Date('2026-10-31T17:30:00Z') });
  assert.equal(endOfOctober.months.at(-1), '2026-10');
  // ...and 1 Nov 2026 00:30 IST (31 Oct 19:00 UTC) adds the November column.
  const startOfNovember = dieselPrices.presentTable(table, { now: new Date('2026-10-31T19:00:00Z') });
  assert.equal(startOfNovember.months.at(-1), '2026-11');
  assert.equal(startOfNovember.months.length, endOfOctober.months.length + 1);
  assert.equal(startOfNovember.months[0], '2024-12');
});

test('fetchFuelPriceTodayDaily records city prices and the state average of tracked cities', async () => {
  const fetchImpl = async (url) => {
    const json = (body) => ({ ok: true, json: async () => body });
    if (url.endsWith('/data.json')) {
      return json({
        lastUpdated: '2026-10-02T07:28:41+00:00',
        cities: [
          { name: 'Amaravati', state: 'Andhra Pradesh', diesel: 105.2 },
          { name: 'Vijayawada', state: 'Andhra Pradesh', diesel: 104.8 },
          { name: 'Hyderabad', state: 'Telangana', diesel: 104.23 },
          { name: 'Puducherry', state: 'Puducherry (UT)', diesel: 93.79 },
          { name: 'Karaikal', state: 'Puducherry (UT)', diesel: 93.59 },
          { name: 'Mysuru', state: 'Karnataka', diesel: 98.39 }, // no Bengaluru today -> state only
          { name: 'Mumbai', state: 'Maharashtra', diesel: 97.83 },
        ],
      });
    }
    if (url.endsWith('/data-yesterday.json')) {
      return json({ lastUpdated: '2026-10-01T07:43:43+00:00', cities: [{ name: 'Amaravati', state: 'Andhra Pradesh', diesel: 105.1 }] });
    }
    if (url.endsWith('/history.json')) {
      return json({
        Hyderabad: [{ date: '2026-10-02', diesel: 104.23 }, { date: '2026-09-30', diesel: 104.1 }],
        Chennai: [{ date: '2026-10-02', diesel: 99.55 }],
      });
    }
    throw new Error(`unexpected ${url}`);
  };
  const { city, state, errors } = await dieselPrices.fetchFuelPriceTodayDaily({ fetchImpl });
  assert.deepEqual(errors, []);
  assert.deepEqual(city['Andhra Pradesh'], { '2026-10-01': 105.1, '2026-10-02': 105.2 });
  assert.deepEqual(state['Andhra Pradesh'], { '2026-10-01': 105.1, '2026-10-02': 105 });
  assert.deepEqual(city.Telangana, { '2026-09-30': 104.1, '2026-10-02': 104.23 });
  assert.deepEqual(city['Tamil Nadu'], { '2026-10-02': 99.55 });
  assert.deepEqual(city.Pondicherry, { '2026-10-02': 93.79 });
  assert.deepEqual(state.Pondicherry, { '2026-10-02': 93.69 });
  assert.deepEqual(city.Karnataka, {});
  assert.deepEqual(state.Karnataka, { '2026-10-02': 98.39 });
  assert.deepEqual(city.Kerala, {});
});

test('fetchFuelPriceTodayDaily reports a failed file without losing the others', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/history.json')) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ lastUpdated: '2026-10-02T07:00:00+00:00', cities: [{ name: 'Chennai', state: 'Tamil Nadu', diesel: 99.5 }] }) };
  };
  const { city, errors } = await dieselPrices.fetchFuelPriceTodayDaily({ fetchImpl });
  assert.deepEqual(city['Tamil Nadu'], { '2026-10-02': 99.5 });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /history\.json/);
});

test('fetchV3carsCityData returns city + state daily history and city + state monthly averages', async () => {
  const now = dieselPrices.currentMonthKey();
  const fetchImpl = async (url) => {
    const { pathname, searchParams } = new URL(url);
    const json = (body) => ({ ok: true, json: async () => body });
    if (pathname.endsWith('/fuel/states/combined')) {
      return json({ success: true, rows: [{ stateId: 17, stateName: 'Karnataka' }, { stateId: 32, stateName: 'Telangana' }] });
    }
    if (pathname.endsWith('/fuel/cities')) {
      const stateId = searchParams.get('stateId');
      return json({
        success: true,
        rows: stateId === '17'
          ? [{ districtId: 668, cityName: 'Bengaluru' }, { districtId: 1046, cityName: 'Bangalore' }, { districtId: 1050, cityName: 'Mysore' }]
          : [{ districtId: 810, cityName: 'Hyderabad' }, { districtId: 811, cityName: 'Warangal' }],
      });
    }
    if (pathname.endsWith('/fuel/price/history')) {
      assert.equal(searchParams.get('fuelType'), '2');
      if (searchParams.has('stateId')) {
        return json({ success: true, rows: [{ day: '2026-10-01', price: searchParams.get('stateId') === '17' ? '99.2' : '104.0' }] });
      }
      const d = searchParams.get('districtId');
      assert.ok(d === '1046' || d === '810', `unexpected district ${d}`);
      return json({ success: true, rows: [{ day: '2026-10-01', price: d === '1046' ? '99.5' : '104.2' }] });
    }
    if (pathname.endsWith('/fuel/monthly/trends')) {
      const d = searchParams.get('districtId');
      if (d === '810') return json({ success: true, months: [{ month: now, avgPrice: 104.1 }, { month: '2026-08', avgPrice: 103.9 }] }); // gap: no 2026-09
      if (d === '1046') return json({ success: true, months: [{ month: '2026-02', avgPrice: 99.123 }] }); // city history starts later than the state
      return json({ success: true, months: [{ month: '2026-09', avgPrice: d === '811' ? 105 : 90 }, { month: '2026-08', avgPrice: 100 }] });
    }
    throw new Error(`unexpected ${url}`);
  };
  const rows = DIESEL_PRICE_ROWS.filter((row) => ['Karnataka', 'Telangana', 'Kerala'].includes(row.state));
  const { daily, monthly, errors } = await dieselPrices.fetchV3carsCityData({ fetchImpl, rows });

  assert.deepEqual(daily.city.Karnataka, { '2026-10-01': 99.5 });
  assert.deepEqual(daily.state.Karnataka, { '2026-10-01': 99.2 });
  assert.deepEqual(daily.city.Telangana, { '2026-10-01': 104.2 });
  assert.deepEqual(daily.state.Telangana, { '2026-10-01': 104.0 });
  assert.deepEqual(monthly.Karnataka.city, { '2026-02': 99.12 });
  // state monthly = mean of all three districts (Bengaluru 90, Bangalore 99.123, Mysore 90 for 2026-09 ...)
  assert.deepEqual(monthly.Karnataka.state, { '2026-09': 90, '2026-08': 100, '2026-02': 99.12 });
  assert.deepEqual(monthly.Telangana.city, { [now]: 104.1, '2026-08': 103.9 });
  assert.deepEqual(monthly.Telangana.state, { [now]: 104.1, '2026-09': 105, '2026-08': 101.95 });
  assert.deepEqual(daily.city.Kerala, {});
  assert.deepEqual(errors, ['v3cars: state Kerala not found']);
});
