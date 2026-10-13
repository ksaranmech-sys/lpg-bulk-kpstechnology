// In-memory cache over the Setting collection so hot paths (trip detail, salary) can read the
// route KM table synchronously. Loaded once after the DB connects; writes update both.
const fs = require('fs');
const path = require('path');
const Setting = require('../models/Setting');
const { ROUTE_KM_TABLE } = require('../config/constants');

const KEYS = {
  ROUTE_KM_TABLE: 'routeKmTable',
  MOBILE_APP_URL: 'mobileAppUrl',
  DIESEL_PRICE_TABLE: 'dieselPriceTable',
  RATE_TABLE_BASES: 'rateTableBases',
  RATE_TABLE_CELLS: 'rateTableCells',
  SHORTAGE_RATES: 'shortageRates',
  LEGACY_IOC_RATE_BASES: 'iocRateBases',
};
const LEGACY_ROUTE_KM_FILE = path.join(__dirname, '../config/routeKmTable.json');

const cache = {
  [KEYS.ROUTE_KM_TABLE]: null,
  [KEYS.MOBILE_APP_URL]: process.env.MOBILE_APP_URL || '',
  [KEYS.DIESEL_PRICE_TABLE]: null,
  [KEYS.RATE_TABLE_BASES]: null,
  [KEYS.RATE_TABLE_CELLS]: null,
  [KEYS.SHORTAGE_RATES]: [],
};

// Pre-DB seed: the JSON file earlier versions wrote to disk, else the built-in defaults.
function legacyRouteKmTable() {
  try {
    if (fs.existsSync(LEGACY_ROUTE_KM_FILE)) {
      const rows = JSON.parse(fs.readFileSync(LEGACY_ROUTE_KM_FILE, 'utf8'));
      if (Array.isArray(rows)) return rows;
    }
  } catch (err) {
    // fall through to defaults
  }
  return [...ROUTE_KM_TABLE];
}

async function initSettings() {
  const docs = await Setting.find({ key: { $in: Object.values(KEYS) } });
  const byKey = Object.fromEntries(docs.map((doc) => [doc.key, doc.value]));

  if (Array.isArray(byKey[KEYS.ROUTE_KM_TABLE])) {
    cache[KEYS.ROUTE_KM_TABLE] = byKey[KEYS.ROUTE_KM_TABLE];
  } else {
    cache[KEYS.ROUTE_KM_TABLE] = legacyRouteKmTable();
    await Setting.updateOne({ key: KEYS.ROUTE_KM_TABLE }, { value: cache[KEYS.ROUTE_KM_TABLE] }, { upsert: true });
  }
  if (typeof byKey[KEYS.MOBILE_APP_URL] === 'string') {
    cache[KEYS.MOBILE_APP_URL] = byKey[KEYS.MOBILE_APP_URL];
  }
  if (byKey[KEYS.DIESEL_PRICE_TABLE] && typeof byKey[KEYS.DIESEL_PRICE_TABLE] === 'object') {
    cache[KEYS.DIESEL_PRICE_TABLE] = byKey[KEYS.DIESEL_PRICE_TABLE];
  }
  if (byKey[KEYS.RATE_TABLE_BASES] && typeof byKey[KEYS.RATE_TABLE_BASES] === 'object') {
    cache[KEYS.RATE_TABLE_BASES] = byKey[KEYS.RATE_TABLE_BASES];
  } else if (byKey[KEYS.LEGACY_IOC_RATE_BASES] && typeof byKey[KEYS.LEGACY_IOC_RATE_BASES] === 'object') {
    // Earlier versions stored only the Tamil Nadu table's bases under a single key.
    cache[KEYS.RATE_TABLE_BASES] = { 'tn-18mt': byKey[KEYS.LEGACY_IOC_RATE_BASES] };
  }
  if (byKey[KEYS.RATE_TABLE_CELLS] && typeof byKey[KEYS.RATE_TABLE_CELLS] === 'object') {
    cache[KEYS.RATE_TABLE_CELLS] = byKey[KEYS.RATE_TABLE_CELLS];
  }
  if (Array.isArray(byKey[KEYS.SHORTAGE_RATES])) {
    cache[KEYS.SHORTAGE_RATES] = byKey[KEYS.SHORTAGE_RATES];
  }
}

function getRouteKmTable() {
  return cache[KEYS.ROUTE_KM_TABLE] || legacyRouteKmTable();
}

async function saveRouteKmTable(rows) {
  cache[KEYS.ROUTE_KM_TABLE] = rows;
  await Setting.updateOne({ key: KEYS.ROUTE_KM_TABLE }, { value: rows }, { upsert: true });
  return rows;
}

function getMobileAppUrl() {
  return cache[KEYS.MOBILE_APP_URL] || '';
}

async function saveMobileAppUrl(url) {
  cache[KEYS.MOBILE_APP_URL] = url;
  await Setting.updateOne({ key: KEYS.MOBILE_APP_URL }, { value: url }, { upsert: true });
  return url;
}

// Shape is owned by utils/dieselPrices.js; null until the first save/sync.
function getDieselPriceTable() {
  return cache[KEYS.DIESEL_PRICE_TABLE];
}

async function saveDieselPriceTable(table) {
  cache[KEYS.DIESEL_PRICE_TABLE] = table;
  await Setting.updateOne({ key: KEYS.DIESEL_PRICE_TABLE }, { value: table }, { upsert: true });
  return table;
}

// Super admin overrides for the rate tables' "Base" column: { [tableId]: { [rowKey]: number } }.
function getRateTableBases(tableId) {
  const all = cache[KEYS.RATE_TABLE_BASES] || {};
  return all[tableId] || null;
}

async function saveRateTableBases(tableId, bases) {
  const all = { ...(cache[KEYS.RATE_TABLE_BASES] || {}), [tableId]: bases };
  cache[KEYS.RATE_TABLE_BASES] = all;
  await Setting.updateOne({ key: KEYS.RATE_TABLE_BASES }, { value: all }, { upsert: true });
  return bases;
}

// Super admin overrides for individual month cells of the rate tables:
// { [tableId]: { [rowKey]: { [month]: number } } }. An overridden cell replaces the calculated value.
function getRateTableCells(tableId) {
  const all = cache[KEYS.RATE_TABLE_CELLS] || {};
  return all[tableId] || null;
}

async function saveRateTableCells(tableId, cells) {
  const all = { ...(cache[KEYS.RATE_TABLE_CELLS] || {}), [tableId]: cells };
  cache[KEYS.RATE_TABLE_CELLS] = all;
  await Setting.updateOne({ key: KEYS.RATE_TABLE_CELLS }, { value: all }, { upsert: true });
  return cells;
}

// Drops every manual month value of every rate table ("Recalculate all"); Base overrides are kept.
async function clearRateTableCells() {
  cache[KEYS.RATE_TABLE_CELLS] = {};
  await Setting.updateOne({ key: KEYS.RATE_TABLE_CELLS }, { value: {} }, { upsert: true });
  return {};
}

function getShortageRates() {
  return Array.isArray(cache[KEYS.SHORTAGE_RATES]) ? cache[KEYS.SHORTAGE_RATES] : [];
}

async function saveShortageRates(rates) {
  const normalized = Array.isArray(rates) ? rates : [];
  cache[KEYS.SHORTAGE_RATES] = normalized;
  await Setting.updateOne({ key: KEYS.SHORTAGE_RATES }, { value: normalized }, { upsert: true });
  return normalized;
}

module.exports = {
  initSettings,
  getRouteKmTable,
  saveRouteKmTable,
  getMobileAppUrl,
  saveMobileAppUrl,
  getDieselPriceTable,
  saveDieselPriceTable,
  getRateTableBases,
  saveRateTableBases,
  getRateTableCells,
  saveRateTableCells,
  clearRateTableCells,
  getShortageRates,
  saveShortageRates,
};
