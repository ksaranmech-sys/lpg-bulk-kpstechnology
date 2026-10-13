// Monthly Income shown to admins: every unloading of a customer's trips that happened in a month,
// split first by the vehicle's corporation (IOC, BPC, HPC, ...) and then by the route's state
// (the suffix of the KM table corporation: IOC-TN -> TN, BPC-KA -> KA, ...). A trip's
// Load leg belongs to the month of its Unloading date; a diverted trip's Divert leg belongs to
// the month of its Divert (new unloading) date, so the two legs may be billed in different
// months. Each row carries that leg's income:
//   TDS    = Trip Income x 2%
//   Diesel = (Trip Income - TDS) x 40%
//   Amount = (Trip Income - TDS) x 60% - Shortage
// Shortage is weight loss above 40 kg times the configured Rs/Kg rate, reported only on the Load
// leg to avoid double-counting diverted trips.
// The month cut-off depends on the vehicle's corporation (Vehicle.corporation): IOC / HPC bill
// the calendar month, while BPC's month runs to the 5th of the next month (an unloading on
// 1-5 Oct belongs to September). Legs whose income cannot be calculated yet (no weight / KM) are
// listed with null figures and left out of the totals.
const Trip = require('../models/Trip');
const { computeTripIncome, corporationStateCode } = require('./tripIncome');
const dieselPrices = require('./dieselPrices');
const { MONTHLY_INCOME_CUTOFF_DAY, MONTHLY_INCOME_HALF_MONTH_CORPORATIONS, MONTHLY_INCOME_HALF_MONTH_DAY } = require('../config/constants');

const TDS_RATE = 0.02;
const DIESEL_SHARE = 0.4;
const AMOUNT_SHARE = 0.6;
const IST_OFFSET = '+05:30';
const UNKNOWN_VEHICLE_CORPORATION = 'No vehicle corporation';
const UNKNOWN_STATE = 'Unknown route';
// Widest cut-off any corporation uses, so the DB query covers every candidate unloading.
const MAX_CUTOFF_DAY = Math.max(0, ...Object.values(MONTHLY_INCOME_CUTOFF_DAY));

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

function splitIncome(income, shortage = 0) {
  if (!Number.isFinite(income)) return { tds: null, diesel: null, amount: null };
  const tds = round2(income * TDS_RATE);
  const net = income - tds;
  const shortageAmount = Number.isFinite(shortage) ? shortage : 0;
  return { tds, diesel: round2(net * DIESEL_SHARE), amount: round2(net * AMOUNT_SHARE - shortageAmount) };
}

function sumRows(rows) {
  const priced = rows.filter((row) => Number.isFinite(row.tripIncome));
  const total = (key) => round2(priced.reduce((sum, row) => sum + row[key], 0));
  const shortageRows = rows.filter((row) => Number.isFinite(row.shortage));
  return {
    trips: rows.length,
    pricedTrips: priced.length,
    tripIncome: total('tripIncome'),
    shortage: shortageRows.length
      ? round2(shortageRows.reduce((sum, row) => sum + row.shortage, 0))
      : null,
    tds: total('tds'),
    diesel: total('diesel'),
    amount: total('amount'),
  };
}

// Cut-off day for a vehicle corporation: 0 = calendar month, N = the month runs to the Nth of the
// next month (unloadings on days 1..N belong to the previous month).
function cutoffDayFor(vehicleCorporation) {
  return MONTHLY_INCOME_CUTOFF_DAY[vehicleCorporation] || 0;
}

// Billing month of an unloading for a vehicle corporation (IST).
function billingMonthOf(value, vehicleCorporation) {
  if (!value) return null;
  const day = dieselPrices.istDayKey(value);
  if (!day) return null;
  const month = day.slice(0, 7);
  const dayOfMonth = Number(day.slice(8, 10));
  return dayOfMonth <= cutoffDayFor(vehicleCorporation) ? previousMonthKey(month) : month;
}

function isHalfMonthCorporation(vehicleCorporation) {
  return MONTHLY_INCOME_HALF_MONTH_CORPORATIONS.includes(vehicleCorporation);
}

// Billing period within the month: IOC / HPC split into 'first-half' (1st-15th) and
// 'second-half' (16th-month end); every other corporation has a single 'month' period.
function billingPeriodOf(value, vehicleCorporation) {
  if (!isHalfMonthCorporation(vehicleCorporation)) return 'month';
  const day = dieselPrices.istDayKey(value);
  if (!day) return null;
  return Number(day.slice(8, 10)) <= MONTHLY_INCOME_HALF_MONTH_DAY ? 'first-half' : 'second-half';
}

function daysInMonth(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m, 0)).getUTCDate();
}

// Period descriptors for a vehicle corporation in `month`, in display order.
function periodsFor(vehicleCorporation, month) {
  const last = daysInMonth(month);
  if (isHalfMonthCorporation(vehicleCorporation)) {
    return [
      { key: 'first-half', label: `1 - ${MONTHLY_INCOME_HALF_MONTH_DAY}`, from: `${month}-01`, to: `${month}-${String(MONTHLY_INCOME_HALF_MONTH_DAY).padStart(2, '0')}` },
      { key: 'second-half', label: `${MONTHLY_INCOME_HALF_MONTH_DAY + 1} - ${last}`, from: `${month}-${String(MONTHLY_INCOME_HALF_MONTH_DAY + 1).padStart(2, '0')}`, to: `${month}-${String(last).padStart(2, '0')}` },
    ];
  }
  const cutoff = cutoffDayFor(vehicleCorporation);
  if (cutoff > 0) {
    const [year, m] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, m, 1));
    const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
    return [{ key: 'month', label: `${cutoff + 1} - ${cutoff} (next month)`, from: `${month}-${String(cutoff + 1).padStart(2, '0')}`, to: `${nextKey}-${String(cutoff).padStart(2, '0')}` }];
  }
  return [{ key: 'month', label: `1 - ${last}`, from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }];
}

// One row per unloading of the trip: the Load leg (dated by Unloading date) and, for a diverted
// trip, the Divert leg (dated by Divert date). Legs without their unloading date are not yet
// billable and are skipped.
function unloadingRows(trip, income, shortageRatePerKg) {
  const vehicleCorporation = trip.vehicle?.corporation || null;
  const base = {
    tripId: String(trip._id),
    vehicleNumber: trip.vehicle?.vehicleNumber || '',
    vehicleCorporation,
    cutoffDay: cutoffDayFor(vehicleCorporation),
    loadingDate: trip.loadingDate || null,
    status: trip.status,
    corporation: income.corporation || null,
    state: corporationStateCode(income.corporation) || null,
    notes: income.errors || [],
  };
  const legs = income.legs || [];
  const legRow = (leg, from, to, unloadingDate) => {
    const legIncome = Number.isFinite(leg?.income) ? leg.income : null;
    const hasShortageWeights = leg?.leg === 'load' &&
      Number.isFinite(trip.loadingWeightTons) &&
      Number.isFinite(trip.unloadingWeightTons) &&
      Number.isFinite(shortageRatePerKg) &&
      shortageRatePerKg >= 0;
    const shortage = hasShortageWeights
      ? round2(Math.max(0, (trip.loadingWeightTons - trip.unloadingWeightTons) * 1000 - 40) * shortageRatePerKg)
      : null;
    return {
      ...base,
      leg: leg?.leg || 'load',
      month: billingMonthOf(unloadingDate, vehicleCorporation),
      period: billingPeriodOf(unloadingDate, vehicleCorporation),
      loadingLocation: from || '',
      unloadingLocation: to || '',
      unloadingDate,
      incomeKm: Number.isFinite(leg?.km) ? leg.km : null,
      tripIncome: legIncome,
      shortage,
      ...splitIncome(legIncome, shortage ?? 0),
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
function buildMonthlyIncome(trips, month, routeKmTable, { getRateTable, now, shortageRatePerKg } = {}) {
  const options = {};
  if (getRateTable) options.getRateTable = getRateTable;
  if (now) options.now = now;

  const rows = trips
    .flatMap((trip) => unloadingRows(trip, computeTripIncome(trip, routeKmTable, options), shortageRatePerKg))
    .filter((row) => row.month === month)
    .sort((a, b) => {
      const byDate = new Date(a.unloadingDate) - new Date(b.unloadingDate);
      return byDate || a.vehicleNumber.localeCompare(b.vehicleNumber);
    });

  // Main split: the vehicle's corporation (IOC, BPC, HPC, ...); then the billing period (IOC / HPC
  // are billed per half month, others once); then the route's state from the KM table
  // corporation (IOC-TN -> TN, BPC-KA -> KA, ...).
  const groupBy = (list, keyOf) => {
    const map = new Map();
    list.forEach((row) => {
      const key = keyOf(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  };
  const sortKeys = (unknownKey) => ([a], [b]) => (a === unknownKey) - (b === unknownKey) || a.localeCompare(b);

  const stateGroups = (list) => Array.from(groupBy(list, (row) => row.state || UNKNOWN_STATE).entries())
    .sort(sortKeys(UNKNOWN_STATE))
    .map(([state, stateRows]) => ({
      state,
      known: state !== UNKNOWN_STATE,
      // KM-table corporations behind this state (normally one, e.g. IOC-TN)
      corporations: Array.from(new Set(stateRows.map((row) => row.corporation).filter(Boolean))).sort(),
      rows: stateRows.map((row, index) => ({ sNo: index + 1, ...row })),
      totals: sumRows(stateRows),
    }));

  const groups = Array.from(groupBy(rows, (row) => row.vehicleCorporation || UNKNOWN_VEHICLE_CORPORATION).entries())
    .sort(sortKeys(UNKNOWN_VEHICLE_CORPORATION))
    .map(([vehicleCorporation, groupRows]) => {
      const corporation = vehicleCorporation === UNKNOWN_VEHICLE_CORPORATION ? null : vehicleCorporation;
      const byPeriod = groupBy(groupRows, (row) => row.period);
      return {
        vehicleCorporation,
        known: vehicleCorporation !== UNKNOWN_VEHICLE_CORPORATION,
        cutoffDay: cutoffDayFor(corporation),
        halfMonth: isHalfMonthCorporation(corporation),
        // Every configured period is listed (even when empty) so both halves always show for IOC / HPC.
        periods: periodsFor(corporation, month).map((period) => {
          const periodRows = byPeriod.get(period.key) || [];
          return { ...period, states: stateGroups(periodRows), totals: sumRows(periodRows) };
        }),
        totals: sumRows(groupRows),
      };
    });

  return {
    month,
    rates: { tds: TDS_RATE, diesel: DIESEL_SHARE, amount: AMOUNT_SHARE, shortagePerKg: shortageRatePerKg ?? null },
    cutoffDays: MONTHLY_INCOME_CUTOFF_DAY,
    halfMonthCorporations: MONTHLY_INCOME_HALF_MONTH_CORPORATIONS,
    halfMonthDay: MONTHLY_INCOME_HALF_MONTH_DAY,
    groups,
    totals: sumRows(rows),
  };
}

async function loadTripsForMonth(customerId, month) {
  // Trips with an unloading (first or divert) inside the month (IST), extended by the widest
  // corporation cut-off (BPC: up to the 5th of the next month). buildMonthlyIncome re-checks each
  // leg's billing month per vehicle corporation, so nothing is counted twice or dropped.
  const { start, end } = monthBounds(month);
  const windowEnd = new Date(end.getTime() + MAX_CUTOFF_DAY * 24 * 60 * 60 * 1000);
  const inWindow = { $gte: start, $lt: windowEnd };
  const trips = await Trip.find({ customer: customerId, $or: [{ unloadingDate: inWindow }, { divertDate: inWindow }] })
    .populate('vehicle', 'vehicleNumber corporation')
    .lean();
  return trips;
}

module.exports = {
  TDS_RATE,
  DIESEL_SHARE,
  AMOUNT_SHARE,
  UNKNOWN_VEHICLE_CORPORATION,
  UNKNOWN_STATE,
  isMonthKey,
  previousMonthKey,
  validateIncomeMonth,
  defaultIncomeMonth,
  monthBounds,
  splitIncome,
  cutoffDayFor,
  billingMonthOf,
  billingPeriodOf,
  periodsFor,
  unloadingRows,
  buildMonthlyIncome,
  loadTripsForMonth,
};
