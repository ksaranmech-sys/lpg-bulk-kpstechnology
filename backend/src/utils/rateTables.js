// Super admin "Rate/KM/Ton" tables (one per state, see RATE_TABLES). Everything except the Base
// column is calculated from the Average Diesel Price table (utils/dieselPrices.js) for the
// table's `dieselState`:
//
//   Price 1 paise[m]    = (diesel[m] - diesel[m-1]) / (kmPerLitre * tonnage)        (2 dp)
//   Price Escalation[m] = (diesel[m] - baseDieselPrice) / (kmPerLitre * tonnage)    (2 dp)
//   KM band[m]          = base + Price Escalation[m] * (band midpoint / 2)          (4 dp)
//   451 rows[m]         = base + Price Escalation[m]                                (4 dp)
//
// Band / 451 rows only recalculate in a month where |Price 1 paise| >= 0.01 (a rise or a fall of
// at least one paise); otherwise (including months where the diesel value is missing) the previous
// month's value is carried forward, and the first month falls back to Base. Downstream rows use
// the rounded (displayed) values of the Price rows, exactly as the spreadsheet does.
const settings = require('./settings');
const dieselPrices = require('./dieselPrices');
const { RATE_TABLES } = require('../config/constants');

const PRICE_1_PAISE_THRESHOLD = 0.01;

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toFinite(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function findConfig(tableId) {
  return RATE_TABLES.find((table) => table.id === tableId) || null;
}

// Band midpoint / 2, e.g. 0~50 -> 12.5, 51~100 -> 37.75. Rows without a band (451 ...) use 1.
function multiplierFor(row) {
  if (!Number.isFinite(row?.low) || !Number.isFinite(row?.high)) return 1;
  return (row.low + row.high) / 2 / 2;
}

function previousMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return m === 1 ? `${year - 1}-12` : `${year}-${String(m - 1).padStart(2, '0')}`;
}

// Base overrides: { [rowKey]: number } validated against the table's configured rows.
function normalizeBases(raw, config) {
  const bases = {};
  const source = raw && typeof raw === 'object' ? raw : {};
  config.rows.forEach((row) => {
    const override = toFinite(source[row.key]);
    bases[row.key] = override !== null && override >= 0 ? roundTo(override, 4) : row.base;
  });
  return bases;
}

function applyBaseEdits(current, edits, config) {
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) throw new Error('bases must be an object keyed by row');
  const next = normalizeBases(current, config);
  const keys = new Set(config.rows.map((row) => row.key));
  Object.entries(edits).forEach(([key, raw]) => {
    if (!keys.has(key)) throw new Error(`Unknown row "${key}"`);
    const value = toFinite(raw);
    if (value === null || value < 0) throw new Error(`Invalid base value for ${key}`);
    next[key] = roundTo(value, 4);
  });
  return next;
}

// dieselCells: { [month]: { value } } for the table's state (from the diesel price table).
function computeRateTable(config, { dieselCells = {}, bases, now = new Date() } = {}) {
  const months = dieselPrices.monthRange(config.startMonth, dieselPrices.currentMonthKey(now));
  const resolvedBases = normalizeBases(bases, config);
  const diesel = (month) => toFinite(dieselCells[month]?.value);
  // Rupees per km per ton: a diesel change per litre spread over kmPerLitre km carrying `tonnage`.
  const perKmPerTon = (delta) => roundTo(delta / (config.kmPerLitre * config.tonnage), 2);

  const price1Paise = {};
  const escalation = {};
  const dieselValues = {};
  months.forEach((month) => {
    const current = diesel(month);
    const previous = diesel(previousMonth(month));
    dieselValues[month] = current;
    price1Paise[month] = current !== null && previous !== null ? perKmPerTon(current - previous) : null;
    escalation[month] = current !== null ? perKmPerTon(current - config.baseDieselPrice) : null;
  });

  const rateRows = config.rows.map((row) => {
    const multiplier = multiplierFor(row);
    const base = resolvedBases[row.key];
    const values = {};
    let previousValue = base;
    months.forEach((month) => {
      const recalculate = price1Paise[month] !== null
        && Math.abs(price1Paise[month]) >= PRICE_1_PAISE_THRESHOLD
        && escalation[month] !== null;
      const value = recalculate ? roundTo(base + escalation[month] * multiplier, 4) : previousValue;
      values[month] = { value, carried: !recalculate };
      previousValue = value;
    });
    return {
      key: row.key,
      label: row.label,
      kind: Number.isFinite(row.low) ? 'band' : 'flat',
      low: Number.isFinite(row.low) ? row.low : null,
      high: Number.isFinite(row.high) ? row.high : null,
      base,
      defaultBase: row.base,
      multiplier,
      decimals: 4,
      values,
    };
  });

  const priceRow = (key, label, series) => ({
    key,
    label,
    kind: 'price',
    base: 0,
    decimals: 2,
    values: Object.fromEntries(months.map((month) => [month, { value: series[month], carried: false }])),
  });

  return {
    id: config.id,
    title: config.title,
    startMonth: config.startMonth,
    dieselState: config.dieselState,
    params: { baseDieselPrice: config.baseDieselPrice, kmPerLitre: config.kmPerLitre, tonnage: config.tonnage },
    months,
    dieselValues,
    rows: [
      priceRow('price-1-paise', 'Price 1 paise', price1Paise),
      priceRow('price-escalation', 'Price Escalation', escalation),
      ...rateRows,
    ],
  };
}

function getRateTable(tableId, { now } = {}) {
  const config = findConfig(tableId);
  if (!config) return null;
  const dieselTable = dieselPrices.getTable({ now });
  return computeRateTable(config, {
    dieselCells: dieselTable.cells?.[config.dieselState] || {},
    bases: settings.getRateTableBases(config.id),
    now,
  });
}

function listRateTables({ now } = {}) {
  return RATE_TABLES.map((config) => getRateTable(config.id, { now }));
}

// Value of a row for a month: the month's cell when it exists, Base before the table starts, and
// the latest month when asked for a month after the last column.
function rateValueForMonth(rateTable, rowKey, month) {
  const row = rateTable?.rows?.find((r) => r.key === rowKey);
  if (!row) return { value: null, month: null };
  const months = rateTable.months || [];
  if (!months.length || !month || month < months[0]) return { value: row.base, month: 'base' };
  const useMonth = month > months[months.length - 1] ? months[months.length - 1] : month;
  const cell = row.values?.[useMonth];
  return { value: Number.isFinite(cell?.value) ? cell.value : row.base, month: useMonth };
}

async function saveRateTableBases(tableId, edits) {
  const config = findConfig(tableId);
  if (!config) throw new Error(`Unknown rate table "${tableId}"`);
  const next = applyBaseEdits(settings.getRateTableBases(config.id), edits, config);
  await settings.saveRateTableBases(config.id, next);
  return getRateTable(config.id);
}

module.exports = {
  PRICE_1_PAISE_THRESHOLD,
  findConfig,
  multiplierFor,
  previousMonth,
  normalizeBases,
  applyBaseEdits,
  computeRateTable,
  getRateTable,
  listRateTables,
  rateValueForMonth,
  saveRateTableBases,
};
