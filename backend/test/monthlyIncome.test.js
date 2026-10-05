const test = require('node:test');
const assert = require('node:assert/strict');

const monthlyIncome = require('../src/utils/monthlyIncome');
const rateTables = require('../src/utils/rateTables');

const now = new Date('2026-10-03T06:00:00Z');

const routeKmTable = [
  { loadingLocation: 'Mysore, TOP', corporation: 'IOC-KA', unloadingLocation: 'Mysore', km: 60 },
  { loadingLocation: 'Total, Mangalore', corporation: 'IOC-KA', unloadingLocation: 'Shimoga', km: 628 },
  { loadingLocation: 'IPPL, Chennai', corporation: 'IOC-TN', unloadingLocation: 'Chengalpattu', km: 120 },
];

function fakeRateTable(id) {
  const config = rateTables.findConfig(id);
  return rateTables.computeRateTable(config, { dieselCells: { '2026-09': { value: 100 } }, now });
}
const opts = { getRateTable: fakeRateTable, now };

function rate(id, rowKey) {
  return rateTables.rateValueForMonth(fakeRateTable(id), rowKey, '2026-09').value;
}

const trips = [
  // loaded in August, unloaded in September -> September
  { _id: 'a', vehicle: { vehicleNumber: 'KA01AA0001' }, status: 'closed', loadingLocation: 'Mysore, TOP', unloadingLocation: 'Mysore', unloadingWeightTons: 18, loadingDate: new Date('2026-08-30T03:00:00Z'), unloadingDate: new Date('2026-09-10T03:00:00Z') },
  { _id: 'b', vehicle: { vehicleNumber: 'KA01AA0002' }, status: 'closed', loadingLocation: 'Total, Mangalore', unloadingLocation: 'Shimoga', unloadingWeightTons: 17.5, loadingDate: new Date('2026-09-04T03:00:00Z'), unloadingDate: new Date('2026-09-05T03:00:00Z') },
  { _id: 'c', vehicle: { vehicleNumber: 'TN01BB0001' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-09-20T03:00:00Z'), unloadingDate: new Date('2026-09-20T09:00:00Z') },
  // unloaded without weight: listed, but not priced
  { _id: 'd', vehicle: { vehicleNumber: 'TN01BB0002' }, status: 'open', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', loadingDate: new Date('2026-09-25T03:00:00Z'), unloadingDate: new Date('2026-09-25T09:00:00Z') },
  // route with no corporation in the KM table
  { _id: 'e', vehicle: { vehicleNumber: 'TN01BB0003' }, status: 'closed', loadingLocation: 'Nowhere', unloadingLocation: 'Elsewhere', manualKm: 50, unloadingWeightTons: 18, loadingDate: new Date('2026-09-26T03:00:00Z'), unloadingDate: new Date('2026-09-26T09:00:00Z') },
  // loaded in September, but 30 Sep 23:00 UTC unloading is already 1 Oct in IST -> October
  { _id: 'f', vehicle: { vehicleNumber: 'KA01AA0003' }, status: 'closed', loadingLocation: 'Mysore, TOP', unloadingLocation: 'Mysore', unloadingWeightTons: 18, loadingDate: new Date('2026-09-30T03:00:00Z'), unloadingDate: new Date('2026-09-30T23:00:00Z') },
  // loaded in September but not unloaded yet -> not billable
  { _id: 'g', vehicle: { vehicleNumber: 'KA01AA0004' }, status: 'open', loadingLocation: 'Mysore, TOP', unloadingLocation: 'Mysore', loadingDate: new Date('2026-09-28T03:00:00Z') },
  // diverted: first unloading in September (Load leg), new unloading in October (Divert leg)
  {
    _id: 'h', vehicle: { vehicleNumber: 'TN01BB0004' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18,
    isDiverted: true, divertUnloadingLocation: 'Salem', manualKmDivert: 100,
    loadingDate: new Date('2026-09-29T03:00:00Z'), unloadingDate: new Date('2026-09-30T09:00:00Z'), divertDate: new Date('2026-10-01T09:00:00Z'),
  },
];

test('TDS is 2% of income, diesel/amount split the rest 40/60', () => {
  assert.deepEqual(monthlyIncome.splitIncome(10000), { tds: 200, diesel: 3920, amount: 5880 });
  assert.deepEqual(monthlyIncome.splitIncome(null), { tds: null, diesel: null, amount: null });
});

test('month helpers: default is the previous month; future months are rejected', () => {
  assert.equal(monthlyIncome.defaultIncomeMonth(now), '2026-09');
  assert.equal(monthlyIncome.previousMonthKey('2026-01'), '2025-12');
  assert.equal(monthlyIncome.validateIncomeMonth('2026-10', now), null);
  assert.equal(monthlyIncome.validateIncomeMonth('2026-09', now), null);
  assert.match(monthlyIncome.validateIncomeMonth('2026-11', now), /future/);
  assert.match(monthlyIncome.validateIncomeMonth('2026-9', now), /YYYY-MM/);
  const { start, end } = monthlyIncome.monthBounds('2026-09');
  assert.equal(start.toISOString(), '2026-08-31T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-09-30T18:30:00.000Z');
});

test('trips are grouped by corporation with per-group and overall totals', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-09', routeKmTable, opts);
  assert.equal(result.month, '2026-09');
  assert.deepEqual(result.groups.map((g) => g.corporation), ['IOC-KA', 'IOC-TN', monthlyIncome.UNKNOWN_CORPORATION]);

  const ka = result.groups[0];
  assert.deepEqual(ka.rows.map((r) => [r.sNo, r.vehicleNumber]), [[1, 'KA01AA0002'], [2, 'KA01AA0001']]); // by unloading date
  const incomeA = Math.round(18 * rate('ka-18mt', 'km-51-100') * 100) / 100;
  const incomeB = Math.round(17.5 * 628 * rate('ka-18mt', 'mangalore-451') * 100) / 100;
  assert.equal(ka.rows[1].tripIncome, incomeA);
  assert.equal(ka.rows[0].tripIncome, incomeB);
  assert.equal(ka.rows[1].unloadingDate, trips[0].unloadingDate);
  assert.equal(ka.rows[1].loadingDate, trips[0].loadingDate);
  assert.deepEqual(ka.totals, {
    trips: 2,
    pricedTrips: 2,
    tripIncome: Math.round((incomeA + incomeB) * 100) / 100,
    tds: Math.round((ka.rows[0].tds + ka.rows[1].tds) * 100) / 100,
    diesel: Math.round((ka.rows[0].diesel + ka.rows[1].diesel) * 100) / 100,
    amount: Math.round((ka.rows[0].amount + ka.rows[1].amount) * 100) / 100,
  });

  const tn = result.groups[1];
  assert.deepEqual(tn.rows.map((r) => [r.tripId, r.leg]), [['c', 'load'], ['d', 'load'], ['h', 'load']]);
  const open = tn.rows.find((r) => r.tripId === 'd');
  assert.equal(open.tripIncome, null);
  assert.equal(open.tds, null);
  assert.ok(open.notes.some((n) => /weight/i.test(n)));
  // the diverted trip's Load leg is billed in September with only the load-leg income
  const divertedLoad = tn.rows.find((r) => r.tripId === 'h');
  assert.deepEqual([divertedLoad.loadingLocation, divertedLoad.unloadingLocation], ['IPPL, Chennai', 'Chengalpattu']);
  assert.equal(divertedLoad.tripIncome, Math.round(18 * rate('tn-18mt', 'km-101-150') * 100) / 100);
  assert.equal(tn.totals.trips, 3);
  assert.equal(tn.totals.pricedTrips, 2);
  assert.equal(tn.totals.tripIncome, Math.round((tn.rows[0].tripIncome + divertedLoad.tripIncome) * 100) / 100);

  const unknown = result.groups[2];
  assert.equal(unknown.known, false);
  assert.deepEqual(unknown.rows.map((r) => r.tripId), ['e']);
  assert.equal(unknown.rows[0].incomeKm, 100);
  assert.equal(unknown.rows[0].tripIncome, null);

  assert.equal(result.totals.trips, 6); // f -> October (IST), g not unloaded, h's divert leg -> October
  assert.equal(result.totals.pricedTrips, 4);
  assert.equal(result.totals.tripIncome, Math.round((ka.totals.tripIncome + tn.totals.tripIncome) * 100) / 100);
});

test('a diverted trip\'s Divert leg is billed in the month of the new unloading, from the first unloading point', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-10', routeKmTable, opts);
  const tn = result.groups.find((g) => g.corporation === 'IOC-TN');
  assert.deepEqual(tn.rows.map((r) => [r.tripId, r.leg]), [['h', 'divert']]);
  const divert = tn.rows[0];
  assert.deepEqual([divert.loadingLocation, divert.unloadingLocation], ['Chengalpattu', 'Salem']);
  assert.equal(divert.unloadingDate, trips[7].divertDate);
  assert.equal(divert.incomeKm, 200); // manual KM divert 100 x 2
  assert.equal(divert.tripIncome, Math.round(18 * rate('tn-18mt', 'km-151-200') * 100) / 100);
  const ka = result.groups.find((g) => g.corporation === 'IOC-KA');
  assert.deepEqual(ka.rows.map((r) => r.tripId), ['f']);
});

test('a month with no unloadings returns empty groups and zero totals', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-07', routeKmTable, opts);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.totals, { trips: 0, pricedTrips: 0, tripIncome: 0, tds: 0, diesel: 0, amount: 0 });
});
