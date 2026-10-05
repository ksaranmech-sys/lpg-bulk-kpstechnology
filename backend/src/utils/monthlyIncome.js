// Monthly Income shown to admins: every unloading of a customer's trips that happened in a month,
// grouped by the corporation the trip's income was priced with (IOC-KA, IOC-TN, ...). A trip's
// Load leg belongs to the month of its Unloading date; a diverted trip's Divert leg belongs to
// the month of its Divert (new unloading) date, so the two legs may be billed in different
// months. Each row carries that leg's income:
//   TDS    = Trip Income x 2%
//   Diesel = (Trip Income - TDS) x 40%
//   Amount = (Trip Income - TDS) x 60%
// Legs whose income cannot be calculated yet (no weight / KM) are listed with null figures and
// left out of the totals.
const Trip = require('../models/Trip');
const { computeTripIncome } = require('./tripIncome');
const dieselPrices = require('./dieselPrices');

const TDS_RATE = 0.02;
const DIESEL_SHARE = 0.4;
const AMOUNT_SHARE = 0.6;
const IST_OFFSET = '+05:30';
const UNKNOWN_CORPORATION = 'Unknown corporation';

function round2(value) {
  return Math.round(value * 100) / 100;
}

function isMonthKey(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value || ''));
}

function previousMonthKey(month) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Months an admin can open: anything up to the current month (the current month is still in
// progress, so the UI defaults to the previous month).
function validateIncomeMonth(month, now = new Date()) {
  if (!isMonthKey(month)) return 'month must be in YYYY-MM format';
  if (month > dieselPrices.currentMonthKey(now)) return 'Income for a future month is not available';
  return null;
}

function defaultIncomeMonth(now = new Date()) {
  return previousMonthKey(dieselPrices.currentMonthKey(now));
}

// Start of the month and of the next month, as instants in IST.
function monthBounds(month) {
  const [year, m] = month.split('-').map(Number);
  const next = m === 12 ? `${year + 1}-01` : `${year}-${String(m + 1).padStart(2, '0')}`;
  return { start: new Date(`${month}-01T00:00:00${IST_OFFSET}`), end: new Date(`${next}-01T00:00:00${IST_OFFSET}`) };
}

function splitIncome(income) {
  if (!Number.isFinite(income)) return { tds: null, diesel: null, amount: null };
  const tds = round2(income * TDS_RATE);
  const net = income - tds;
  return { tds, diesel: round2(net * DIESEL_SHARE), amount: round2(net * AMOUNT_SHARE) };
}

function sumRows(rows) {
  const priced = rows.filter((row) => Number.isFinite(row.tripIncome));
  const total = (key) => round2(priced.reduce((sum, row) => sum + row[key], 0));
  return {
    trips: rows.length,
    pricedTrips: priced.length,
    tripIncome: total('tripIncome'),
    tds: total('tds'),
    diesel: total('diesel'),
    amount: total('amount'),
  };
}

// IST month ('YYYY-MM') of a date, or null.
function monthOf(value) {
  if (!value) return null;
  const day = dieselPrices.istDayKey(value);
  return day ? day.slice(0, 7) : null;
}

// One row per unloading of the trip: the Load leg (dated by Unloading date) and, for a diverted
// trip, the Divert leg (dated by Divert date). Legs without their unloading date are not yet
// billable and are skipped.
function unloadingRows(trip, income) {
  const base = {
    tripId: String(trip._id),
    vehicleNumber: trip.vehicle?.vehicleNumber || '',
    loadingDate: trip.loadingDate || null,
    status: trip.status,
    corporation: income.corporation || null,
    notes: income.errors || [],
  };
  const legs = income.legs || [];
  const legRow = (leg, from, to, unloadingDate) => {
    const legIncome = Number.isFinite(leg?.income) ? leg.income : null;
    return {
      ...base,
      leg: leg?.leg || 'load',
      month: monthOf(unloadingDate),
      loadingLocation: from || '',
      unloadingLocation: to || '',
      unloadingDate,
      incomeKm: Number.isFinite(leg?.km) ? leg.km : null,
      tripIncome: legIncome,
      ...splitIncome(legIncome),
    };
  };

  const rows = [];
  if (trip.unloadingDate) {
    rows.push(legRow(legs.find((leg) => leg.leg === 'load'), trip.loadingLocation, trip.unloadingLocation, trip.unloadingDate));
  }
  if (trip.isDiverted && trip.divertUnloadingLocation && trip.divertDate) {
    rows.push(legRow(legs.find((leg) => leg.leg === 'divert'), trip.unloadingLocation, trip.divertUnloadingLocation, trip.divertDate));
  }
  return rows;
}

// trips: plain trip objects with `vehicle` populated ({ vehicleNumber }); routeKmTable: KM table rows.
function buildMonthlyIncome(trips, month, routeKmTable, { getRateTable, now } = {}) {
  const options = {};
  if (getRateTable) options.getRateTable = getRateTable;
  if (now) options.now = now;

  const rows = trips
    .flatMap((trip) => unloadingRows(trip, computeTripIncome(trip, routeKmTable, options)))
    .filter((row) => row.month === month)
    .sort((a, b) => {
      const byDate = new Date(a.unloadingDate) - new Date(b.unloadingDate);
      return byDate || a.vehicleNumber.localeCompare(b.vehicleNumber);
    });

  const byCorporation = new Map();
  rows.forEach((row) => {
    const key = row.corporation || UNKNOWN_CORPORATION;
    if (!byCorporation.has(key)) byCorporation.set(key, []);
    byCorporation.get(key).push(row);
  });
  const groups = Array.from(byCorporation.entries())
    .sort(([a], [b]) => (a === UNKNOWN_CORPORATION) - (b === UNKNOWN_CORPORATION) || a.localeCompare(b))
    .map(([corporation, groupRows]) => ({
      corporation,
      known: corporation !== UNKNOWN_CORPORATION,
      rows: groupRows.map((row, index) => ({ sNo: index + 1, ...row })),
      totals: sumRows(groupRows),
    }));

  return {
    month,
    rates: { tds: TDS_RATE, diesel: DIESEL_SHARE, amount: AMOUNT_SHARE },
    groups,
    totals: sumRows(rows),
  };
}

async function loadTripsForMonth(customerId, month) {
  // Trips with an unloading (first or divert) inside the month (IST). buildMonthlyIncome re-checks
  // each leg's IST month so an unloading late on the last day is never counted twice or dropped.
  const { start, end } = monthBounds(month);
  const inMonth = { $gte: start, $lt: end };
  const trips = await Trip.find({ customer: customerId, $or: [{ unloadingDate: inMonth }, { divertDate: inMonth }] })
    .populate('vehicle', 'vehicleNumber')
    .lean();
  return trips;
}

module.exports = {
  TDS_RATE,
  DIESEL_SHARE,
  AMOUNT_SHARE,
  UNKNOWN_CORPORATION,
  isMonthKey,
  previousMonthKey,
  validateIncomeMonth,
  defaultIncomeMonth,
  monthBounds,
  splitIncome,
  unloadingRows,
  buildMonthlyIncome,
  loadTripsForMonth,
};
