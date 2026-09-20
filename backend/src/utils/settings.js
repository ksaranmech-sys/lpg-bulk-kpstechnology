// In-memory cache over the Setting collection so hot paths (trip detail, salary) can read the
// route KM table synchronously. Loaded once after the DB connects; writes update both.
const fs = require('fs');
const path = require('path');
const Setting = require('../models/Setting');
const { ROUTE_KM_TABLE } = require('../config/constants');

const KEYS = { ROUTE_KM_TABLE: 'routeKmTable', MOBILE_APP_URL: 'mobileAppUrl' };
const LEGACY_ROUTE_KM_FILE = path.join(__dirname, '../config/routeKmTable.json');

const cache = {
  [KEYS.ROUTE_KM_TABLE]: null,
  [KEYS.MOBILE_APP_URL]: process.env.MOBILE_APP_URL || '',
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

module.exports = { initSettings, getRouteKmTable, saveRouteKmTable, getMobileAppUrl, saveMobileAppUrl };
