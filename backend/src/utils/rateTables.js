// Super admin "Rate/KM/Ton" tables (one per state, see RATE_TABLES). Everything except the Base
// column is calculated from the Average Diesel Price table (utils/dieselPrices.js) for the
// table's `dieselState`:
//
//   Price 1 paise[m]    = (diesel[m] - diesel[m-1]) / (kmPerLitre * tonnage)                (shown 2 dp)
//   Price Escalation[m] = (diesel[m] - diesel[baseDieselMonth]) / (kmPerLitre * tonnage)    (shown 2 dp)
//   KM band[m]          = base + Price Escalation[m] * band midpoint  (0~50 -> 25)          (4 dp)
//   451 rows[m]         = base + Price Escalation[m]                                        (4 dp)
//
// The reference diesel is the state's Average Diesel Price for config.baseDieselMonth (Dec-24);
// while that cell is empty Price Escalation is blank and every row keeps its Base.
// Band / 451 rows only recalculate in a month where |Price 1 paise| >= 0.01 (a rise or a fall of
// at least one paise); otherwise (including months where the diesel value is missing) the previous
// month's value is carried forward, and the first month falls back to Base. The Price rows are
// displayed to 2 dp but, exactly as the spreadsheet does, the band / 451 rows and the recalculation
// check use their full-precision values (e.g. 151~200 = 1049.8361 + (95.22 - 92.41) / 57.6 x 175.5
// = 1058.3978, not 1049.8361 + 0.05 x 175.5).
//
// Base revisions (config.baseRevisions, contract years 4 and 5 - see RATE_TABLE_BASE_REVISIONS):
// in the revision month every row's Base becomes R + (R - F) x rate, where R is the row's value in
// the previous month and F = average KM x previous-month diesel / (kmPerLitre x tonnage), and the
// Price Escalation reference diesel resets to that previous-month diesel. The revision month always
// recalculates (new Base + Price Escalation x multiplier) and later months use the new Base.
const settings = require('./settings');
const dieselPrices = require('./dieselPrices');
const { RATE_TABLES } = require('../config/constants');

const PRICE_1_PAISE_THRESHOLD = 0.01;
// Absorbs binary floating-point noise so a change of exactly one paise (e.g. 0.63 / 63) still counts.
const FLOAT_TOLERANCE = 1e-9;
// How far back to look for a diesel value when the month before a Base revision has none.
const REVISION_DIESEL_LOOKBACK_MONTHS = 24;

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

// Band midpoint, e.g. 0~50 -> 25, 51~100 -> 75.5. Rows without a band (451 ...) use 1.
function multiplierFor(row) {
  if (!Number.isFinite(row?.low) || !Number.isFinite(row?.high)) return 1;
  return (row.low + row.high) / 2;
}

// Average KM of a band, e.g. 0~50 -> 25, used for the fuel component of a Base revision. 451 rows use 1.
function averageKmFor(row) {
  if (!Number.isFinite(row?.low) || !Number.isFinite(row?.high)) return 1;
  return (row.low + row.high) / 2;
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

// Month-cell overrides: { [rowKey]: { [month]: number } } limited to configured rows, valid
// 'YYYY-MM' months and non-negative numbers; anything else is dropped.
function normalizeCells(raw, config) {
  const cells = {};
  const source = raw && typeof raw === 'object' ? raw : {};
  config.rows.forEach((row) => {
    const months = source[row.key];
    if (!months || typeof months !== 'object') return;
    Object.entries(months).forEach(([month, value]) => {
      const num = toFinite(value);
      if (!dieselPrices.isMonthKey(month) || num === null || num < 0) return;
      if (!cells[row.key]) cells[row.key] = {};
      cells[row.key][month] = roundTo(num, 4);
    });
  });
  return cells;
}

// edits: { [rowKey]: { [month]: number | null } } - null / '' clears the override for that cell.
function applyCellEdits(current, edits, config) {
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) throw new Error('cells must be an object keyed by row');
  const next = normalizeCells(current, config);
  const keys = new Set(config.rows.map((row) => row.key));
  Object.entries(edits).forEach(([key, months]) => {
    if (!keys.has(key)) throw new Error(`Unknown row "${key}"`);
    if (!months || typeof months !== 'object' || Array.isArray(months)) throw new Error(`cells for ${key} must be an object keyed by month`);
    Object.entries(months).forEach(([month, raw]) => {
      if (!dieselPrices.isMonthKey(month) || month < config.startMonth) throw new Error(`Invalid month "${month}" for ${key}`);
      if (raw === null || raw === '') {
        if (next[key]) delete next[key][month];
        if (next[key] && !Object.keys(next[key]).length) delete next[key];
        return;
      }
      const value = toFinite(raw);
      if (value === null || value < 0) throw new Error(`Invalid value for ${key} ${month}`);
      if (!next[key]) next[key] = {};
      next[key][month] = roundTo(value, 4);
    });
  });
  return next;
}

// dieselCells: { [month]: { value } } for the table's state (from the diesel price table);
// cells: super admin per-month overrides (see normalizeCells).
function computeRateTable(config, { dieselCells = {}, bases, cells, now = new Date() } = {}) {
  const months = dieselPrices.monthRange(config.startMonth, dieselPrices.currentMonthKey(now));
  const resolvedBases = normalizeBases(bases, config);
  const overrides = normalizeCells(cells, config);
  const diesel = (month) => toFinite(dieselCells[month]?.value);
  // Rupees per km per ton: a diesel change per litre spread over kmPerLitre km carrying `tonnage`.
  // Kept at full precision: the Price rows are displayed to 2 dp but the KM / 451 rows and the
  // recalculation check use the exact figure, as the spreadsheet does.
  const litreDivisor = config.kmPerLitre * config.tonnage;
  const perKmPerTon = (delta) => delta / litreDivisor;
  // Latest diesel value strictly before `month` (normally the previous month).
  const latestDieselBefore = (month) => {
    let cursor = month;
    for (let i = 0; i < REVISION_DIESEL_LOOKBACK_MONTHS; i += 1) {
      cursor = previousMonth(cursor);
      const value = diesel(cursor);
      if (value !== null) return { month: cursor, value };
    }
    return null;
  };

  const price1Paise = {};
  const escalation = {};
  const dieselValues = {};
  const referenceDiesel = {};
  const revisionByMonth = {};
  const scheduled = Array.isArray(config.baseRevisions) ? config.baseRevisions : [];
  const baseDieselPrice = diesel(config.baseDieselMonth);
  let reference = baseDieselPrice;
  let pendingRevision = null;
  months.forEach((month) => {
    const current = diesel(month);
    const previous = diesel(previousMonth(month));
    // A revision whose anchor month has no diesel value waits for the next month that has one.
    pendingRevision = scheduled.find((rev) => rev.month === month) || pendingRevision;
    if (pendingRevision) {
      const anchor = latestDieselBefore(month);
      if (anchor) {
        reference = anchor.value;
        revisionByMonth[month] = { scheduledMonth: pendingRevision.month, rate: pendingRevision.rate, dieselMonth: anchor.month, dieselPrice: anchor.value };
        pendingRevision = null;
      }
    }
    referenceDiesel[month] = reference;
    dieselValues[month] = current;
    price1Paise[month] = current !== null && previous !== null ? perKmPerTon(current - previous) : null;
    escalation[month] = current !== null && reference !== null ? perKmPerTon(current - reference) : null;
  });

  const rateRows = config.rows.map((row) => {
    const multiplier = multiplierFor(row);
    const averageKm = averageKmFor(row);
    const base = resolvedBases[row.key];
    const rowOverrides = overrides[row.key] || {};
    const values = {};
    const revisions = {};
    let currentBase = base;
    let previousValue = base;
    months.forEach((month) => {
      const override = rowOverrides[month];
      const revision = revisionByMonth[month];
      if (revision) {
        const fuel = averageKm * revision.dieselPrice / litreDivisor;
        const increment = (previousValue - fuel) * revision.rate;
        currentBase = roundTo(previousValue + increment, 4);
        revisions[month] = {
          base: currentBase,
          previousValue,
          fuel: roundTo(fuel, 4),
          increment: roundTo(increment, 4),
          rate: revision.rate,
          dieselMonth: revision.dieselMonth,
          dieselPrice: revision.dieselPrice,
        };
      }
      const recalculate = Boolean(revision) || (price1Paise[month] !== null
        && Math.abs(price1Paise[month]) >= PRICE_1_PAISE_THRESHOLD - FLOAT_TOLERANCE
        && escalation[month] !== null);
      const calculated = recalculate ? roundTo(currentBase + (escalation[month] ?? 0) * multiplier, 4) : previousValue;
      // A manually entered cell wins over the formula and is what later months carry forward.
      const value = override !== undefined ? override : calculated;
      values[month] = {
        value,
        carried: override === undefined && !recalculate,
        overridden: override !== undefined,
        calculated,
        ...(revision ? { revision: revisions[month] } : {}),
      };
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
      currentBase,
      revisions,
      multiplier,
      averageKm,
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
    // Displayed to 2 dp; `exact` is the full-precision figure the KM / 451 rows were built from.
    values: Object.fromEntries(months.map((month) => [month, {
      value: series[month] === null ? null : roundTo(series[month], 2),
      exact: series[month],
      carried: false,
    }])),
  });

  return {
    id: config.id,
    title: config.title,
    startMonth: config.startMonth,
    dieselState: config.dieselState,
    params: {
      baseDieselMonth: config.baseDieselMonth,
      baseDieselPrice,
      kmPerLitre: config.kmPerLitre,
      tonnage: config.tonnage,
      baseRevisions: scheduled,
    },
    months,
    dieselValues,
    referenceDiesel,
    revisions: revisionByMonth,
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
    cells: settings.getRateTableCells(config.id),
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

async function saveRateTableCells(tableId, edits) {
  const config = findConfig(tableId);
  if (!config) throw new Error(`Unknown rate table "${tableId}"`);
  const next = applyCellEdits(settings.getRateTableCells(config.id), edits, config);
  await settings.saveRateTableCells(config.id, next);
  return getRateTable(config.id);
}

// "Recalculate all": clears every manually entered month value in every table so each cell shows
// the figure calculated from the diesel prices again. Base edits are kept.
async function recalculateAllRateTables({ now } = {}) {
  await settings.clearRateTableCells();
  return listRateTables({ now });
}

module.exports = {
  PRICE_1_PAISE_THRESHOLD,
  findConfig,
  multiplierFor,
  averageKmFor,
  previousMonth,
  normalizeBases,
  applyBaseEdits,
  normalizeCells,
  applyCellEdits,
  computeRateTable,
  getRateTable,
  listRateTables,
  rateValueForMonth,
  saveRateTableBases,
  saveRateTableCells,
  recalculateAllRateTables,
};
