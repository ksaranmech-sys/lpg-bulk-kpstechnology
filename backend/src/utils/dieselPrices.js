// Super admin "Average Diesel Price" table: one monthly average per state, priced from a single
// reference city (see DIESEL_PRICE_ROWS) with the state-level price as fallback whenever the city
// has no figure. Auto-calculated and editable by hand; persisted as a single Setting document.
//
// Sources
//   1. fuelpricetoday.in (primary) publishes today's city prices (data.json), yesterday's
//      (data-yesterday.json) and a 10-day history for metros (history.json). It keeps no longer
//      history, so every sync records the daily price here and the month's average is computed
//      from those stored daily prices. Its state price is the mean of the cities it tracks.
//   2. v3cars.com (backfill) exposes the city as a "district" with a 90-day daily history and up
//      to 24 months of monthly averages, plus a state-level 90-day daily history. The state-level
//      monthly figure is the mean of the state's district monthly averages.
//
// Precedence
//   - per day:   city price (fuelpricetoday > v3cars) > state price (fuelpricetoday > v3cars)
//   - per month: manual > daily-avg (from stored daily prices) > city monthly > state monthly
// Within a month only city days are averaged when the city has any; state days are used only
// when the city has none. Cells built from state-level data carry `fallback: true`.
const settings = require('./settings');
const { DIESEL_PRICE_ROWS, DIESEL_PRICE_START_MONTH } = require('../config/constants');

const FUEL_PRICE_TODAY_BASE = process.env.FUEL_PRICE_TODAY_BASE || 'https://www.fuelpricetoday.in';
const V3CARS_API_BASE = process.env.V3CARS_API_BASE || 'https://www.v3cars.com/v1';
const DIESEL_FUEL_TYPE = 2; // v3cars: 1 = petrol, 2 = diesel, 3 = CNG
const V3CARS_HISTORY_DAYS = 90;
const V3CARS_TREND_MONTHS = 24;
const V3CARS_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 20000;
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const LEVELS = { CITY: 'city', STATE: 'state' };
const LEVEL_PRIORITY = { [LEVELS.CITY]: 2, [LEVELS.STATE]: 1 };

const SOURCES = { MANUAL: 'manual', DAILY_AVG: 'daily-avg', CITY_MONTHLY: 'v3cars-monthly', STATE_MONTHLY: 'v3cars-state-monthly' };
const SOURCE_PRIORITY = { [SOURCES.MANUAL]: 4, [SOURCES.DAILY_AVG]: 3, [SOURCES.CITY_MONTHLY]: 2, [SOURCES.STATE_MONTHLY]: 1 };

// ---------- date helpers ----------

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function isMonthKey(value) {
  return typeof value === 'string' && MONTH_RE.test(value);
}

function isDayKey(value) {
  return typeof value === 'string' && DAY_RE.test(value);
}

// Calendar date in India for a timestamp (prices are revised at 6am IST, so IST is the right day).
function istDayKey(value) {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function currentMonthKey(now = new Date()) {
  return istDayKey(now).slice(0, 7);
}

function monthRange(start, end) {
  if (!isMonthKey(start) || !isMonthKey(end) || start > end) return [];
  const [startYear, startMonth] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  const months = [];
  for (let y = startYear, m = startMonth; y < endYear || (y === endYear && m <= endMonth);) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return months;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toPrice(value) {
  const num = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function mean(values) {
  const nums = values.map(toPrice).filter((v) => v !== null);
  return nums.length ? round2(nums.reduce((sum, v) => sum + v, 0) / nums.length) : null;
}

// ---------- pure calculations ----------

// Stored daily entries { day: { value, level } } -> { month: { value, days, stateDays } }.
// City and state prices are never mixed within a month: if the city has at least MIN_CITY_DAYS
// price(s) that month, only the city days are averaged; otherwise the state-level days are used.
const MIN_CITY_DAYS = 1;

function averageDailyByMonth(dailyEntries) {
  const buckets = {};
  Object.entries(dailyEntries || {}).forEach(([day, entry]) => {
    const price = toPrice(entry?.value);
    if (!isDayKey(day) || price === null) return;
    const month = day.slice(0, 7);
    buckets[month] = buckets[month] || { city: [], state: [] };
    buckets[month][entry.level === LEVELS.STATE ? 'state' : 'city'].push(price);
  });
  return Object.fromEntries(Object.entries(buckets).map(([month, { city, state }]) => {
    if (city.length >= MIN_CITY_DAYS) return [month, { value: mean(city), days: city.length, stateDays: 0 }];
    return [month, { value: mean(state), days: state.length, stateDays: state.length }];
  }));
}

// Several districts' monthly trend arrays -> { month: meanOfDistrictAverages }
function averageDistrictMonths(districtMonthLists) {
  const buckets = {};
  (Array.isArray(districtMonthLists) ? districtMonthLists : []).forEach((months) => {
    (Array.isArray(months) ? months : []).forEach((entry) => {
      const price = toPrice(entry?.avgPrice);
      if (!isMonthKey(entry?.month) || price === null) return;
      buckets[entry.month] = buckets[entry.month] || [];
      buckets[entry.month].push(price);
    });
  });
  return Object.fromEntries(Object.entries(buckets).map(([month, prices]) => [month, mean(prices)]));
}

function emptyTable() {
  return {
    startMonth: DIESEL_PRICE_START_MONTH,
    rows: DIESEL_PRICE_ROWS.map(({ state, city }) => ({ state, city })),
    cells: Object.fromEntries(DIESEL_PRICE_ROWS.map(({ state }) => [state, {}])),
    daily: Object.fromEntries(DIESEL_PRICE_ROWS.map(({ state }) => [state, {}])),
    lastSyncedAt: null,
    lastSyncError: '',
  };
}

function normalizeCell(cell) {
  const value = toPrice(cell?.value);
  if (value === null || !SOURCE_PRIORITY[cell?.source]) return null;
  const normalized = { value: round2(value), source: cell.source };
  if (cell.fallback === true) normalized.fallback = true;
  return normalized;
}

// Rows and the start month always come from config so changing them is a code change (a start
// month saved by an earlier version is ignored); stored cells for a state no longer configured or
// months before the start are dropped, cells with an unknown (legacy) source are discarded so
// they get recalculated, and manual edits are always kept. Daily entries saved as bare numbers by
// earlier versions are treated as city-level prices.
function normalizeTable(raw) {
  const table = emptyTable();
  if (!raw || typeof raw !== 'object') return table;
  if (typeof raw.lastSyncedAt === 'string') table.lastSyncedAt = raw.lastSyncedAt;
  if (typeof raw.lastSyncError === 'string') table.lastSyncError = raw.lastSyncError;
  const cells = raw.cells && typeof raw.cells === 'object' ? raw.cells : {};
  const daily = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
  table.rows.forEach(({ state }) => {
    const stateCells = cells[state] && typeof cells[state] === 'object' ? cells[state] : {};
    Object.entries(stateCells).forEach(([month, cell]) => {
      const normalized = normalizeCell(cell);
      if (!isMonthKey(month) || month < table.startMonth || !normalized) return;
      table.cells[state][month] = normalized;
    });
    const stateDaily = daily[state] && typeof daily[state] === 'object' ? daily[state] : {};
    Object.entries(stateDaily).forEach(([day, entry]) => {
      const price = toPrice(entry && typeof entry === 'object' ? entry.value : entry);
      if (!isDayKey(day) || day.slice(0, 7) < table.startMonth || price === null) return;
      const level = LEVEL_PRIORITY[entry?.level] ? entry.level : LEVELS.CITY;
      table.daily[state][day] = { value: round2(price), level };
    });
  });
  return table;
}

// Records prices per day at a given level. A city price always replaces a state price; within the
// same level `overwrite` is true for the primary source (fuelpricetoday) and false for the backfill.
function recordDailyPrices(table, state, dailyPrices, { level = LEVELS.CITY, overwrite = false, now = new Date() } = {}) {
  if (!table.daily[state] || !LEVEL_PRIORITY[level]) return table;
  const today = istDayKey(now);
  Object.entries(dailyPrices || {}).forEach(([day, raw]) => {
    const price = toPrice(raw);
    if (!isDayKey(day) || day.slice(0, 7) < table.startMonth || day > today || price === null) return;
    const existing = table.daily[state][day];
    if (existing) {
      if (LEVEL_PRIORITY[existing.level] > LEVEL_PRIORITY[level]) return;
      if (existing.level === level && !overwrite) return;
    }
    table.daily[state][day] = { value: round2(price), level };
  });
  return table;
}

// synced: { [state]: { [month]: { value, source, fallback? } } }. A synced value wins over an
// existing cell only when its source is at least as trustworthy; manual edits are never touched.
function mergeSyncedCells(table, synced, { now = new Date() } = {}) {
  const next = normalizeTable(table);
  const latestMonth = currentMonthKey(now);
  next.rows.forEach(({ state }) => {
    const incoming = synced?.[state] || {};
    Object.entries(incoming).forEach(([month, cell]) => {
      const normalized = normalizeCell(cell);
      if (!isMonthKey(month) || month < next.startMonth || month > latestMonth || !normalized) return;
      if (normalized.source === SOURCES.MANUAL) return;
      const existing = next.cells[state][month];
      if (existing && (existing.source === SOURCES.MANUAL || SOURCE_PRIORITY[existing.source] > SOURCE_PRIORITY[normalized.source])) return;
      next.cells[state][month] = normalized;
    });
  });
  return next;
}

// Builds month candidates from the stored daily prices plus the v3cars monthly figures
// ({ [state]: { city: { month: value }, state: { month: value } } }) and merges them in.
function recalculateFromDaily(table, monthlyCandidates = {}, { now = new Date() } = {}) {
  const synced = {};
  table.rows.forEach(({ state }) => {
    synced[state] = {};
    const candidates = monthlyCandidates[state] || {};
    Object.entries(candidates.state || {}).forEach(([month, value]) => {
      synced[state][month] = { value, source: SOURCES.STATE_MONTHLY, fallback: true };
    });
    Object.entries(candidates.city || {}).forEach(([month, value]) => {
      synced[state][month] = { value, source: SOURCES.CITY_MONTHLY };
    });
    Object.entries(averageDailyByMonth(table.daily[state])).forEach(([month, { value, stateDays }]) => {
      synced[state][month] = { value, source: SOURCES.DAILY_AVG, fallback: stateDays > 0 };
    });
  });
  return mergeSyncedCells(table, synced, { now });
}

// edits: { [state]: { [month]: number | '' | null } }. Empty clears the cell so the next sync can
// fill it again; a number pins the cell as a manual value.
function applyManualEdits(table, edits) {
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    throw new Error('cells must be an object keyed by state');
  }
  const next = normalizeTable(table);
  const states = next.rows.map((row) => row.state);
  Object.entries(edits).forEach(([state, months]) => {
    if (!states.includes(state)) throw new Error(`Unknown state "${state}"`);
    if (!months || typeof months !== 'object' || Array.isArray(months)) {
      throw new Error(`Cells for ${state} must be an object keyed by month`);
    }
    Object.entries(months).forEach(([month, rawValue]) => {
      if (!isMonthKey(month) || month < next.startMonth) throw new Error(`Invalid month "${month}" for ${state}`);
      if (rawValue === null || rawValue === undefined || rawValue === '') {
        delete next.cells[state][month];
        return;
      }
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid price for ${state} ${month}`);
      next.cells[state][month] = { value: round2(value), source: SOURCES.MANUAL };
    });
  });
  return next;
}

// What the API returns: the stored table (minus raw daily prices) plus the full month axis.
function presentTable(table, { now = new Date() } = {}) {
  const rest = { ...normalizeTable(table) };
  delete rest.daily;
  return { ...rest, states: rest.rows.map((row) => row.state), months: monthRange(rest.startMonth, currentMonthKey(now)) };
}

// ---------- remote sources ----------

async function fetchJson(url, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; KPS-Fleet/1.0)' },
    signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined,
  });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json();
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

function nameKey(name) {
  return String(name || '').trim().toLowerCase();
}

function emptyPerState(rows) {
  return Object.fromEntries(rows.map(({ state }) => [state, {}]));
}

// fuelpricetoday.in -> { city: { [state]: { [day]: price } }, state: { ... } }. The state price is
// the mean of every city the site tracks in that state (what its "Avg Diesel" column shows).
async function fetchFuelPriceTodayDaily({ fetchImpl, rows = DIESEL_PRICE_ROWS } = {}) {
  const city = emptyPerState(rows);
  const state = emptyPerState(rows);
  const errors = [];
  const byCity = new Map(rows.map((row) => [nameKey(row.fuelPriceTodayCity), row.state]));
  const byState = new Map(rows.map((row) => [nameKey(row.fuelPriceTodayState), row.state]));

  const recordSnapshot = (snapshot) => {
    const day = istDayKey(snapshot?.lastUpdated);
    if (!day) return;
    const statePrices = {};
    (snapshot?.cities || []).forEach((entry) => {
      const price = toPrice(entry?.diesel);
      if (price === null) return;
      const cityState = byCity.get(nameKey(entry?.name));
      if (cityState) city[cityState][day] = price;
      const ownState = byState.get(nameKey(entry?.state));
      if (ownState) (statePrices[ownState] = statePrices[ownState] || []).push(price);
    });
    Object.entries(statePrices).forEach(([ownState, prices]) => {
      const avg = mean(prices);
      if (avg !== null) state[ownState][day] = avg;
    });
  };

  const files = ['data-yesterday.json', 'data.json', 'history.json'];
  const results = await Promise.allSettled(files.map((file) => fetchJson(`${FUEL_PRICE_TODAY_BASE}/${file}`, fetchImpl)));
  results.forEach((r, i) => {
    if (r.status === 'rejected') errors.push(`fuelpricetoday ${files[i]}: ${r.reason?.message}`);
  });
  const [yesterday, today, history] = results.map((r) => (r.status === 'fulfilled' ? r.value : null));

  recordSnapshot(yesterday);
  recordSnapshot(today);
  if (history && typeof history === 'object') {
    Object.entries(history).forEach(([cityName, entries]) => {
      const cityState = byCity.get(nameKey(cityName));
      if (!cityState) return;
      (Array.isArray(entries) ? entries : []).forEach((entry) => {
        const day = isDayKey(entry?.date) ? entry.date : istDayKey(entry?.updated);
        const price = toPrice(entry?.diesel);
        if (day && price !== null) city[cityState][day] = price;
      });
    });
  }

  return { city, state, errors };
}

// v3cars.com -> daily history (city + state level) and monthly averages (city and state) for the
// configured rows.
async function fetchV3carsCityData({ fetchImpl, rows = DIESEL_PRICE_ROWS, log = () => {} } = {}) {
  const daily = { city: emptyPerState(rows), state: emptyPerState(rows) };
  const monthly = Object.fromEntries(rows.map(({ state }) => [state, { city: {}, state: {} }]));
  const errors = [];
  const quiet = (label) => (err) => { log(`[diesel-prices] v3cars ${label}: ${err.message}`); return null; };
  const historyUrl = (param, id) => `${V3CARS_API_BASE}/fuel/price/history?fuelType=${DIESEL_FUEL_TYPE}&${param}=${id}&days=${V3CARS_HISTORY_DAYS}`;
  const trendsUrl = (districtId) => `${V3CARS_API_BASE}/fuel/monthly/trends?fuelType=${DIESEL_FUEL_TYPE}&districtId=${districtId}&months=${V3CARS_TREND_MONTHS}`;
  const toDaily = (history) => Object.fromEntries((history?.rows || [])
    .filter((entry) => isDayKey(entry?.day) && toPrice(entry?.price) !== null)
    .map((entry) => [entry.day, toPrice(entry.price)]));
  const toMonthly = (trend) => Object.fromEntries((trend?.months || [])
    .filter((entry) => isMonthKey(entry?.month) && toPrice(entry?.avgPrice) !== null)
    .map((entry) => [entry.month, round2(toPrice(entry.avgPrice))]));

  let stateIds = new Map();
  try {
    const stateList = await fetchJson(`${V3CARS_API_BASE}/fuel/states/combined?page=1&limit=50`, fetchImpl);
    stateIds = new Map((stateList?.rows || []).map((row) => [nameKey(row.stateName), row.stateId]));
  } catch (err) {
    return { daily, monthly, errors: [`v3cars states: ${err.message}`] };
  }

  await Promise.all(rows.map(async (row) => {
    const stateId = stateIds.get(nameKey(row.v3carsState));
    if (!stateId) {
      errors.push(`v3cars: state ${row.v3carsState} not found`);
      return;
    }
    try {
      const [cities, stateHistory] = await Promise.all([
        fetchJson(`${V3CARS_API_BASE}/fuel/cities?fuelType=${DIESEL_FUEL_TYPE}&stateId=${stateId}&limit=100`, fetchImpl),
        fetchJson(historyUrl('stateId', stateId), fetchImpl).catch(quiet(`state history ${row.state}`)),
      ]);
      daily.state[row.state] = toDaily(stateHistory);

      const districts = (cities?.rows || []).filter((c) => c?.districtId);
      const district = districts.find((c) => nameKey(c.cityName) === nameKey(row.v3carsDistrict));
      if (!district) errors.push(`v3cars: ${row.v3carsDistrict} not found in ${row.v3carsState}`);

      if (district) {
        const [cityHistory, cityTrend] = await Promise.all([
          fetchJson(historyUrl('districtId', district.districtId), fetchImpl).catch(quiet(`history ${row.city}`)),
          fetchJson(trendsUrl(district.districtId), fetchImpl).catch(quiet(`trends ${row.city}`)),
        ]);
        daily.city[row.state] = toDaily(cityHistory);
        monthly[row.state].city = toMonthly(cityTrend);
      }

      // State-level monthly average = mean of every district's monthly average; used for months
      // the city has no figure for (e.g. the city's history starts later than the state's).
      const trends = await mapWithConcurrency(districts, V3CARS_CONCURRENCY, (d) => (
        fetchJson(trendsUrl(d.districtId), fetchImpl).then((t) => t?.months || []).catch(quiet(`trends ${d.cityName}`))
      ));
      monthly[row.state].state = averageDistrictMonths(trends.filter(Boolean));
    } catch (err) {
      errors.push(`v3cars ${row.state}: ${err.message}`);
    }
  }));

  return { daily, monthly, errors };
}

// ---------- persistence / orchestration ----------

function getTable({ now } = {}) {
  return presentTable(settings.getDieselPriceTable(), { now });
}

async function saveManualEdits(edits) {
  const next = applyManualEdits(settings.getDieselPriceTable(), edits);
  await settings.saveDieselPriceTable(next);
  return presentTable(next);
}

let syncInFlight = null;

// Pulls fresh figures from both sources and merges them into the stored table. Concurrent callers
// share one run. Never throws on upstream failure: the error is recorded on the table instead.
function syncDieselPrices({ fetchImpl, now = new Date(), log = console.log } = {}) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    let next = normalizeTable(settings.getDieselPriceTable());
    try {
      const [primary, backfill] = await Promise.all([
        fetchFuelPriceTodayDaily({ fetchImpl, rows: DIESEL_PRICE_ROWS }),
        fetchV3carsCityData({ fetchImpl, rows: DIESEL_PRICE_ROWS, log }),
      ]);
      next.rows.forEach(({ state }) => {
        // Order matters only within a level: the primary source is recorded last so it wins ties.
        recordDailyPrices(next, state, backfill.daily.state[state], { level: LEVELS.STATE, overwrite: false, now });
        recordDailyPrices(next, state, primary.state[state], { level: LEVELS.STATE, overwrite: true, now });
        recordDailyPrices(next, state, backfill.daily.city[state], { level: LEVELS.CITY, overwrite: false, now });
        recordDailyPrices(next, state, primary.city[state], { level: LEVELS.CITY, overwrite: true, now });
      });
      next = recalculateFromDaily(next, backfill.monthly, { now });
      const errors = [...primary.errors, ...backfill.errors];
      next.lastSyncedAt = now.toISOString();
      next.lastSyncError = errors.join('; ');
      if (errors.length) log(`[diesel-prices] Sync finished with issues: ${next.lastSyncError}`);
      else log('[diesel-prices] Synced average diesel prices (fuelpricetoday.in + v3cars.com)');
    } catch (err) {
      next.lastSyncError = err.message || 'Failed to fetch diesel prices';
      log(`[diesel-prices] Sync failed: ${next.lastSyncError}`);
    }
    await settings.saveDieselPriceTable(next);
    return presentTable(next, { now });
  })().finally(() => { syncInFlight = null; });
  return syncInFlight;
}

function isStale(table, now = new Date()) {
  if (!table?.lastSyncedAt) return true;
  const last = new Date(table.lastSyncedAt).getTime();
  return !Number.isFinite(last) || now.getTime() - last > STALE_AFTER_MS;
}

let schedulerTimer = null;

// Called once the DB is connected: syncs now if the stored table is stale, then once a day. Daily
// runs matter here because fuelpricetoday only keeps a few days of history.
function startDieselPriceScheduler({ fetchImpl, log = console.log } = {}) {
  if (schedulerTimer) return schedulerTimer;
  const runIfStale = () => {
    if (!isStale(settings.getDieselPriceTable())) return Promise.resolve();
    return syncDieselPrices({ fetchImpl, log }).catch((err) => log(`[diesel-prices] ${err.message}`));
  };
  runIfStale();
  schedulerTimer = setInterval(runIfStale, SYNC_INTERVAL_MS);
  if (typeof schedulerTimer.unref === 'function') schedulerTimer.unref();
  return schedulerTimer;
}

function stopDieselPriceScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = null;
}

module.exports = {
  SOURCES,
  LEVELS,
  isMonthKey,
  isDayKey,
  istDayKey,
  currentMonthKey,
  monthRange,
  averageDailyByMonth,
  averageDistrictMonths,
  emptyTable,
  normalizeTable,
  recordDailyPrices,
  mergeSyncedCells,
  recalculateFromDaily,
  applyManualEdits,
  presentTable,
  fetchFuelPriceTodayDaily,
  fetchV3carsCityData,
  getTable,
  saveManualEdits,
  syncDieselPrices,
  isStale,
  startDieselPriceScheduler,
  stopDieselPriceScheduler,
};
