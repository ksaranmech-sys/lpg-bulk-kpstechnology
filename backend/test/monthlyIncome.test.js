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

test('billing month follows the vehicle corporation cut-off: IOC / HPC calendar month, BPC to the 5th of the next month', () => {
  assert.equal(monthlyIncome.cutoffDayFor('BPC'), 5);
  assert.equal(monthlyIncome.cutoffDayFor('IOC'), 0);
  assert.equal(monthlyIncome.cutoffDayFor('HPC'), 0);
  assert.equal(monthlyIncome.cutoffDayFor(null), 0);
  const oct3 = new Date('2026-10-03T09:00:00Z');
  const oct5Late = new Date('2026-10-05T18:00:00Z'); // 23:30 IST on the 5th
  const oct6Early = new Date('2026-10-05T19:00:00Z'); // 00:30 IST on the 6th
  assert.equal(monthlyIncome.billingMonthOf(oct3, 'IOC'), '2026-10');
  assert.equal(monthlyIncome.billingMonthOf(oct3, 'HPC'), '2026-10');
  assert.equal(monthlyIncome.billingMonthOf(oct3, 'BPC'), '2026-09');
  assert.equal(monthlyIncome.billingMonthOf(oct5Late, 'BPC'), '2026-09');
  assert.equal(monthlyIncome.billingMonthOf(oct6Early, 'BPC'), '2026-10');
  assert.equal(monthlyIncome.billingMonthOf(new Date('2027-01-02T09:00:00Z'), 'BPC'), '2026-12');
  assert.equal(monthlyIncome.billingMonthOf(null, 'BPC'), null);

  const bpcTrips = [
    // BPC vehicle unloaded 3 Oct -> September; the same date on an IOC vehicle -> October
    { _id: 'p', vehicle: { vehicleNumber: 'TN02CC0001', corporation: 'BPC' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-10-02T03:00:00Z'), unloadingDate: oct3 },
    { _id: 'q', vehicle: { vehicleNumber: 'TN02CC0002', corporation: 'IOC' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-10-02T03:00:00Z'), unloadingDate: oct3 },
    // BPC vehicle unloaded 3 Sep -> belongs to August, not September
    { _id: 'r', vehicle: { vehicleNumber: 'TN02CC0001', corporation: 'BPC' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-09-02T03:00:00Z'), unloadingDate: new Date('2026-09-03T09:00:00Z') },
    // BPC diverted: first unloading 30 Sep (September), divert 4 Oct (still September for BPC)
    {
      _id: 's', vehicle: { vehicleNumber: 'TN02CC0003', corporation: 'BPC' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18,
      isDiverted: true, divertUnloadingLocation: 'Salem', manualKmDivert: 100,
      loadingDate: new Date('2026-09-29T03:00:00Z'), unloadingDate: new Date('2026-09-30T09:00:00Z'), divertDate: new Date('2026-10-04T09:00:00Z'),
    },
  ];
  const sep = monthlyIncome.buildMonthlyIncome(bpcTrips, '2026-09', routeKmTable, opts);
  assert.deepEqual(sep.groups.map((g) => [g.vehicleCorporation, g.cutoffDay, g.halfMonth, g.periods.map((p) => [p.key, p.label, p.states.map((s) => s.state)])]), [['BPC', 5, false, [['month', '6 - 5 (next month)', ['TN']]]]]);
  assert.deepEqual([sep.groups[0].periods[0].from, sep.groups[0].periods[0].to], ['2026-09-06', '2026-10-05']);
  assert.deepEqual(sep.groups[0].periods[0].states[0].rows.map((r) => [r.tripId, r.leg, r.vehicleCorporation, r.cutoffDay, r.state]), [['s', 'load', 'BPC', 5, 'TN'], ['p', 'load', 'BPC', 5, 'TN'], ['s', 'divert', 'BPC', 5, 'TN']]);
  assert.deepEqual(sep.cutoffDays, { BPC: 5 });
  const oct = monthlyIncome.buildMonthlyIncome(bpcTrips, '2026-10', routeKmTable, opts);
  // IOC unloading on 3 Oct -> first half of October; the second half is listed empty
  assert.deepEqual(oct.groups.map((g) => [g.vehicleCorporation, g.halfMonth, g.periods.map((p) => [p.key, p.label, p.states.map((s) => s.rows.map((r) => r.tripId))])]), [['IOC', true, [['first-half', '1 - 15', [['q']]], ['second-half', '16 - 31', []]]]]);
  const aug = monthlyIncome.buildMonthlyIncome(bpcTrips, '2026-08', routeKmTable, opts);
  assert.deepEqual(aug.groups[0].periods[0].states[0].rows.map((r) => r.tripId), ['r']);

  // two vehicle corporations running the same TN / KA routes -> BPC and IOC main groups, each sub-split by state
  const mixed = [
    { _id: 'm1', vehicle: { vehicleNumber: 'V1', corporation: 'IOC' }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-09-02T03:00:00Z'), unloadingDate: new Date('2026-09-03T09:00:00Z') },
    { _id: 'm2', vehicle: { vehicleNumber: 'V1', corporation: 'IOC' }, status: 'closed', loadingLocation: 'Mysore, TOP', unloadingLocation: 'Mysore', unloadingWeightTons: 18, loadingDate: new Date('2026-09-04T03:00:00Z'), unloadingDate: new Date('2026-09-05T09:00:00Z') },
    { _id: 'm3', vehicle: { vehicleNumber: 'V2', corporation: 'BPC' }, status: 'closed', loadingLocation: 'Mysore, TOP', unloadingLocation: 'Mysore', unloadingWeightTons: 18, loadingDate: new Date('2026-09-06T03:00:00Z'), unloadingDate: new Date('2026-09-07T09:00:00Z') },
  ];
  const split = monthlyIncome.buildMonthlyIncome(mixed, '2026-09', routeKmTable, opts);
  assert.deepEqual(split.groups.map((g) => [g.vehicleCorporation, g.periods.map((p) => [p.key, p.states.map((s) => [s.state, s.rows.map((r) => r.tripId)])])]), [
    ['BPC', [['month', [['KA', ['m3']]]]]],
    ['IOC', [['first-half', [['KA', ['m2']], ['TN', ['m1']]]], ['second-half', []]]],
  ]);
  assert.equal(split.groups[1].totals.trips, 2);
  assert.equal(split.totals.trips, 3);
});

test('IOC and HPC months are billed in two halves (1-15, 16-end); BPC and others once', () => {
  assert.equal(monthlyIncome.billingPeriodOf(new Date('2026-09-15T18:00:00Z'), 'IOC'), 'first-half'); // 23:30 IST on the 15th
  assert.equal(monthlyIncome.billingPeriodOf(new Date('2026-09-15T19:00:00Z'), 'IOC'), 'second-half'); // 00:30 IST on the 16th
  assert.equal(monthlyIncome.billingPeriodOf(new Date('2026-09-02T09:00:00Z'), 'HPC'), 'first-half');
  assert.equal(monthlyIncome.billingPeriodOf(new Date('2026-09-02T09:00:00Z'), 'BPC'), 'month');
  assert.equal(monthlyIncome.billingPeriodOf(new Date('2026-09-02T09:00:00Z'), null), 'month');
  assert.deepEqual(monthlyIncome.periodsFor('HPC', '2026-02').map((p) => [p.key, p.label, p.from, p.to]), [['first-half', '1 - 15', '2026-02-01', '2026-02-15'], ['second-half', '16 - 28', '2026-02-16', '2026-02-28']]);
  assert.deepEqual(monthlyIncome.periodsFor('BPC', '2026-12').map((p) => [p.label, p.from, p.to]), [['6 - 5 (next month)', '2026-12-06', '2027-01-05']]);
  assert.deepEqual(monthlyIncome.periodsFor('Total Gas', '2026-09').map((p) => [p.key, p.label]), [['month', '1 - 30']]);

  const trip = (id, corporation, unloadingDate) => ({ _id: id, vehicle: { vehicleNumber: 'V-' + id, corporation }, status: 'closed', loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 18, loadingDate: new Date('2026-09-01T03:00:00Z'), unloadingDate: new Date(unloadingDate) });
  const result = monthlyIncome.buildMonthlyIncome([
    trip('a1', 'IOC', '2026-09-03T09:00:00Z'), trip('a2', 'IOC', '2026-09-15T09:00:00Z'), trip('a3', 'IOC', '2026-09-16T09:00:00Z'), trip('a4', 'IOC', '2026-09-30T09:00:00Z'),
    trip('h1', 'HPC', '2026-09-20T09:00:00Z'),
  ], '2026-09', routeKmTable, opts);
  const byCorp = Object.fromEntries(result.groups.map((g) => [g.vehicleCorporation, g]));
  assert.deepEqual(byCorp.IOC.periods.map((p) => [p.key, p.states[0].rows.map((r) => r.tripId)]), [['first-half', ['a1', 'a2']], ['second-half', ['a3', 'a4']]]);
  assert.equal(byCorp.IOC.periods[0].totals.trips, 2);
  assert.equal(byCorp.IOC.periods[1].totals.trips, 2);
  assert.equal(byCorp.IOC.totals.trips, 4);
  assert.equal(Math.round((byCorp.IOC.periods[0].totals.tripIncome + byCorp.IOC.periods[1].totals.tripIncome) * 100) / 100, byCorp.IOC.totals.tripIncome);
  assert.deepEqual(byCorp.HPC.periods.map((p) => [p.key, p.totals.trips]), [['first-half', 0], ['second-half', 1]]);
  assert.deepEqual(byCorp.HPC.periods[0].states, []);
  assert.deepEqual(result.halfMonthCorporations, ['IOC', 'HPC']);
  assert.equal(result.halfMonthDay, 15);
});

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

test('unloadings are split by vehicle corporation, then by route state, with totals at each level', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-09', routeKmTable, opts);
  assert.equal(result.month, '2026-09');
  // these fixture vehicles carry no corporation -> one main group, split by route state
  assert.deepEqual(result.groups.map((g) => [g.vehicleCorporation, g.known, g.cutoffDay]), [[monthlyIncome.UNKNOWN_VEHICLE_CORPORATION, false, 0]]);
  assert.deepEqual(result.groups[0].periods.map((p) => [p.key, p.label]), [['month', '1 - 30']]);
  const states = result.groups[0].periods[0].states;
  assert.deepEqual(states.map((s) => [s.state, s.known, s.corporations]), [['KA', true, ['IOC-KA']], ['TN', true, ['IOC-TN']], [monthlyIncome.UNKNOWN_STATE, false, []]]);

  const ka = states[0];
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

  const tn = states[1];
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

  const unknown = states[2];
  assert.equal(unknown.known, false);
  assert.deepEqual(unknown.rows.map((r) => r.tripId), ['e']);
  assert.equal(unknown.rows[0].incomeKm, 100);
  assert.equal(unknown.rows[0].tripIncome, null);

  assert.equal(result.totals.trips, 6); // f -> October (IST), g not unloaded, h's divert leg -> October
  assert.equal(result.totals.pricedTrips, 4);
  assert.equal(result.totals.tripIncome, Math.round((ka.totals.tripIncome + tn.totals.tripIncome) * 100) / 100);
  assert.deepEqual(result.groups[0].totals, result.totals);
});

test('a diverted trip\'s Divert leg is billed in the month of the new unloading, from the first unloading point', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-10', routeKmTable, opts);
  const tn = result.groups[0].periods[0].states.find((s) => s.state === 'TN');
  assert.deepEqual(tn.rows.map((r) => [r.tripId, r.leg]), [['h', 'divert']]);
  const divert = tn.rows[0];
  assert.deepEqual([divert.loadingLocation, divert.unloadingLocation], ['Chengalpattu', 'Salem']);
  assert.equal(divert.unloadingDate, trips[7].divertDate);
  assert.equal(divert.incomeKm, 200); // manual KM divert 100 x 2
  assert.equal(divert.tripIncome, Math.round(18 * rate('tn-18mt', 'km-151-200') * 100) / 100);
  const ka = result.groups[0].periods[0].states.find((s) => s.state === 'KA');
  assert.deepEqual(ka.rows.map((r) => r.tripId), ['f']);
});

test('a month with no unloadings returns empty groups and zero totals', () => {
  const result = monthlyIncome.buildMonthlyIncome(trips, '2026-07', routeKmTable, opts);
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.totals, { trips: 0, pricedTrips: 0, tripIncome: 0, tds: 0, diesel: 0, amount: 0 });
});
