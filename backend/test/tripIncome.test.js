const test = require('node:test');
const assert = require('node:assert/strict');

const tripIncome = require('../src/utils/tripIncome');
const rateTables = require('../src/utils/rateTables');

const now = new Date('2026-10-03T06:00:00Z');

const routeKmTable = [
  { loadingLocation: 'Mysore, TOP', corporation: 'IOC-KA', unloadingLocation: 'Mysore', km: 60 },
  { loadingLocation: 'Total, Mangalore', corporation: 'IOC-KA', unloadingLocation: 'Shimoga', km: 628 },
  { loadingLocation: 'IPPL, Chennai', corporation: 'IOC-TN', unloadingLocation: 'Salem', km: 720 },
  { loadingLocation: 'IPPL, Chennai', corporation: 'IOC-TN', unloadingLocation: 'Chengalpattu', km: 120 },
  { loadingLocation: 'Salem', corporation: 'IOC-TN', unloadingLocation: 'Erode', km: 130 },
];

// Fixed rate tables so the expected incomes are independent of live diesel data: Oct-26 values.
function fakeRateTable(id) {
  const config = rateTables.findConfig(id);
  const dieselCells = { '2026-09': { value: 100 }, '2026-10': { value: 101 } }; // +1 -> Price 1 paise 0.02 -> recalculates in Oct-26
  return rateTables.computeRateTable(config, { dieselCells, now });
}
const opts = { getRateTable: fakeRateTable, now };

function expectedRate(id, rowKey, month) {
  return rateTables.rateValueForMonth(fakeRateTable(id), rowKey, month).value;
}

test('Mangalore-base loading locations are recognised in their current and legacy spellings', () => {
  assert.equal(tripIncome.isMangaloreBaseLoading('Total, Mangalore'), true);
  assert.equal(tripIncome.isMangaloreBaseLoading('AEGIS, Mangalore'), true);
  assert.equal(tripIncome.isMangaloreBaseLoading('MRPL, Mangalore'), true);
  assert.equal(tripIncome.isMangaloreBaseLoading('AEGIS-Mangalore'), true);
  assert.equal(tripIncome.isMangaloreBaseLoading('MRPL'), true);
  assert.equal(tripIncome.isMangaloreBaseLoading('IPPL, Chennai'), false);
  assert.equal(tripIncome.isMangaloreBaseLoading('Mysore, TOP'), false);
  assert.equal(tripIncome.isMangaloreBaseLoading(''), false);
});

test('tonnage class and rate table selection follow weight and KM-table corporation', () => {
  assert.equal(tripIncome.tonnageClassFor(17.5), 18);
  assert.equal(tripIncome.tonnageClassFor(18), 18);
  assert.equal(tripIncome.tonnageClassFor(18.01), 21);
  assert.equal(tripIncome.selectRateTableConfig('IOC-TN', 18)?.id, 'tn-18mt');
  assert.equal(tripIncome.selectRateTableConfig('ioc-ka', 18)?.id, 'ka-18mt');
  // every corporation in a state shares that state's table
  assert.equal(tripIncome.selectRateTableConfig('BPC-TN', 18)?.id, 'tn-18mt');
  assert.equal(tripIncome.selectRateTableConfig('BPC-KA', 18)?.id, 'ka-18mt');
  assert.equal(tripIncome.selectRateTableConfig('HPC-KA', 18)?.id, 'ka-18mt');
  assert.equal(tripIncome.selectRateTableConfig('KA', 18)?.id, 'ka-18mt');
  assert.equal(tripIncome.selectRateTableConfig('IOC-KL', 18)?.id, 'kl-18mt');
  assert.equal(tripIncome.selectRateTableConfig('HPC-AP', 18)?.id, 'ap-18mt');
  assert.equal(tripIncome.selectRateTableConfig('IOC-PY', 18)?.id, 'py-18mt');
  assert.equal(tripIncome.selectRateTableConfig('IOC-TS', 18)?.id, 'ts-18mt');
  assert.equal(tripIncome.selectRateTableConfig('IOC-MH', 18), null);
  assert.equal(tripIncome.corporationStateCode('BPC-TN'), 'TN');
  assert.equal(tripIncome.corporationStateCode(''), '');
  assert.equal(tripIncome.selectRateTableConfig('IOC-TN', 21)?.id, 'tn-21mt');
  assert.equal(tripIncome.selectRateTableConfig('BPC-KA', 21)?.id, 'ka-21mt');
  assert.equal(tripIncome.selectRateTableConfig(null, 18), null);
  assert.deepEqual(tripIncome.resolveCorporation(routeKmTable, 'IPPL, Chennai', 'Salem'), { corporation: 'IOC-TN', source: 'route', candidates: ['IOC-TN'] });
  assert.deepEqual(tripIncome.resolveCorporation(routeKmTable, 'IPPL, Chennai', 'Nowhere'), { corporation: 'IOC-TN', source: 'loading-location', candidates: ['IOC-TN'] });
  assert.deepEqual(tripIncome.resolveCorporation(routeKmTable, 'Unknown', 'Shimoga'), { corporation: 'IOC-KA', source: 'unloading-location', candidates: ['IOC-KA'] });
  assert.deepEqual(tripIncome.resolveCorporation(routeKmTable, 'Unknown', 'Nowhere'), { corporation: null, source: null, candidates: [] });
  // a loading point serving two corporations uses the one with the most routes from there
  const twoCorps = [...routeKmTable, { loadingLocation: 'IPPL, Chennai', corporation: 'IOC-KA', unloadingLocation: 'Devangonthi', km: 682 }];
  assert.deepEqual(tripIncome.resolveCorporation(twoCorps, 'IPPL, Chennai', 'Nowhere'), { corporation: 'IOC-TN', source: 'loading-location-majority', candidates: ['IOC-TN', 'IOC-KA'] });
  const majority = tripIncome.computeTripIncome({ loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Nowhere', manualKm: 100, unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z' }, twoCorps, opts);
  assert.equal(majority.totalKm, 200);
  assert.equal(majority.corporation, 'IOC-TN');
  assert.equal(majority.rateTable?.id, 'tn-18mt');
  assert.equal(majority.totalIncome, Math.round(18 * expectedRate('tn-18mt', 'km-151-200', '2026-10') * 100) / 100);
  assert.ok(majority.errors.some((e) => /uses the IOC-TN rate/.test(e)));
  // an even split cannot be guessed
  const tied = [...twoCorps, { loadingLocation: 'IPPL, Chennai', corporation: 'IOC-KA', unloadingLocation: 'Hassan', km: 900 }];
  assert.deepEqual(tripIncome.resolveCorporation(tied, 'IPPL, Chennai', 'Nowhere'), { corporation: null, source: 'ambiguous', candidates: ['IOC-TN', 'IOC-KA'] });
  const ambiguous = tripIncome.computeTripIncome({ loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Nowhere', manualKm: 100, unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z' }, tied, opts);
  assert.equal(ambiguous.totalKm, 200);
  assert.equal(ambiguous.totalIncome, null);
  assert.ok(ambiguous.errors.some((e) => /serves IOC-TN and IOC-KA equally/.test(e)));
});

test('leg KM comes from the KM table, else manual one-way KM x 2', () => {
  assert.deepEqual(tripIncome.legKm(routeKmTable, 'IPPL, Chennai', 'Salem', 999), { km: 720, kmSource: 'km_table' });
  assert.deepEqual(tripIncome.legKm(routeKmTable, 'IPPL, Chennai', 'Namakkal', 380), { km: 760, kmSource: 'manual' });
  assert.deepEqual(tripIncome.legKm(routeKmTable, 'IPPL, Chennai', 'Namakkal', null), { km: null, kmSource: null });
  assert.deepEqual(tripIncome.legKm(routeKmTable, 'IPPL, Chennai', 'Namakkal', ''), { km: null, kmSource: null });
});

test('type 1: trip KM up to 450 -> weight x KM band rate for the loading month', () => {
  const trip = { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 17.2, loadingDate: '2026-10-02T03:00:00Z' };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.tonnageClass, 18);
  assert.equal(result.corporation, 'IOC-TN');
  assert.equal(result.rateTable.id, 'tn-18mt');
  assert.equal(result.month, '2026-10');
  assert.equal(result.mangaloreBase, false);
  assert.equal(result.legs.length, 1);
  const [leg] = result.legs;
  assert.equal(leg.km, 120);
  assert.equal(leg.kmSource, 'km_table');
  assert.equal(leg.type, 'band');
  assert.equal(leg.rateLabel, '101~150 KM');
  const rate = expectedRate('tn-18mt', 'km-101-150', '2026-10');
  assert.equal(leg.rate, rate);
  assert.equal(leg.income, Math.round(17.2 * rate * 100) / 100);
  assert.equal(result.totalKm, 120);
  assert.equal(result.totalIncome, leg.income);
});

test('type 2: trip KM over 450 from a non-Mangalore load -> weight x KM x 451 Normal base', () => {
  const trip = { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Salem', unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z' };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.deepEqual(result.errors, []);
  const [leg] = result.legs;
  assert.equal(leg.km, 720);
  assert.equal(leg.type, 'normal-451');
  assert.equal(leg.rateLabel, '451 Normal base');
  const rate = expectedRate('tn-18mt', 'normal-451', '2026-10');
  assert.equal(leg.rate, rate);
  assert.equal(leg.income, Math.round(18 * 720 * rate * 100) / 100);
  assert.equal(result.totalIncome, leg.income);
});

test('type 3: trip KM over 450 from a Mangalore load -> weight x KM x 451 Mangalore base (KA table)', () => {
  const trip = { loadingLocation: 'Total, Mangalore', unloadingLocation: 'Shimoga', unloadingWeightTons: 16.8, loadingDate: '2026-10-02T03:00:00Z' };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.rateTable.id, 'ka-18mt');
  assert.equal(result.mangaloreBase, true);
  const [leg] = result.legs;
  assert.equal(leg.km, 628);
  assert.equal(leg.type, 'mangalore-451');
  const rate = expectedRate('ka-18mt', 'mangalore-451', '2026-10');
  assert.equal(leg.rate, rate);
  assert.equal(leg.income, Math.round(16.8 * 628 * rate * 100) / 100);
});

test('diverted trip shows two KMs and sums both legs; the divert leg never uses the Mangalore rate', () => {
  const trip = {
    loadingLocation: 'Total, Mangalore', unloadingLocation: 'Shimoga', isDiverted: true, divertUnloadingLocation: 'Davangere',
    manualKmDivert: 100, unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z',
  };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.legs.length, 2);
  const [load, divert] = result.legs;
  assert.deepEqual([load.from, load.to, load.km, load.kmSource, load.type], ['Total, Mangalore', 'Shimoga', 628, 'km_table', 'mangalore-451']);
  assert.deepEqual([divert.from, divert.to, divert.km, divert.kmSource, divert.type, divert.rateLabel], ['Shimoga', 'Davangere', 200, 'manual', 'band', '151~200 KM']);
  assert.equal(result.totalKm, 828);
  assert.equal(result.totalIncome, Math.round((load.income + divert.income) * 100) / 100);
});

test('manual KM load x 2 is used when the route is missing, with the corporation taken from the loading location', () => {
  const trip = { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Namakkal', manualKm: 180, unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z' };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.deepEqual(result.errors, []);
  assert.equal(result.corporationSource, 'loading-location');
  assert.equal(result.rateTable.id, 'tn-18mt');
  assert.deepEqual([result.legs[0].km, result.legs[0].kmSource, result.legs[0].type, result.legs[0].rateLabel], [360, 'manual', 'band', '351~400 KM']);
});

test('months before the rate table starts use Base values', () => {
  const trip = { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Chengalpattu', unloadingWeightTons: 10, loadingDate: '2025-06-10T03:00:00Z' };
  const result = tripIncome.computeTripIncome(trip, routeKmTable, opts);
  assert.equal(result.month, '2025-06');
  assert.equal(result.legs[0].rateMonth, 'base');
  assert.equal(result.legs[0].rate, 890.8584);
  assert.equal(result.legs[0].income, 8908.58);
});

test('missing weight, missing manual KM and unknown states report what is needed instead of a value; weights above 18 t use the 21MT table', () => {
  const noWeight = tripIncome.computeTripIncome({ loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Salem', loadingDate: '2026-10-02T03:00:00Z' }, routeKmTable, opts);
  assert.equal(noWeight.totalKm, 720);
  assert.equal(noWeight.totalIncome, null);
  assert.ok(noWeight.errors.some((e) => /weight/i.test(e)));

  const noKm = tripIncome.computeTripIncome({ loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Namakkal', unloadingWeightTons: 18, loadingDate: '2026-10-02T03:00:00Z' }, routeKmTable, opts);
  assert.equal(noKm.totalKm, null);
  assert.equal(noKm.totalIncome, null);
  assert.ok(noKm.errors.some((e) => /Manual KM Load/.test(e)));

  // 20 t on a 720 km TN route -> TN 21MT table, 451 Normal base
  const heavy = tripIncome.computeTripIncome({ loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Salem', unloadingWeightTons: 20, loadingDate: '2026-10-02T03:00:00Z' }, routeKmTable, opts);
  assert.equal(heavy.tonnageClass, 21);
  assert.equal(heavy.rateTable.id, 'tn-21mt');
  assert.equal(heavy.legs[0].rateLabel, '451 Normal base');
  assert.equal(heavy.totalIncome, Math.round(20 * 720 * expectedRate('tn-21mt', 'normal-451', '2026-10') * 100) / 100);
  assert.deepEqual(heavy.errors, []);

  // a state with no table at all
  const noState = tripIncome.computeTripIncome({ loadingLocation: 'Goa Plant', unloadingLocation: 'Margao', unloadingWeightTons: 20, loadingDate: '2026-10-02T03:00:00Z' }, [
    { loadingLocation: 'Goa Plant', corporation: 'IOC-GA', unloadingLocation: 'Margao', km: 60 },
  ], opts);
  assert.equal(noState.rateTable, null);
  assert.ok(noState.errors.some((e) => /No 21MT Rate\/KM\/Ton table is configured for IOC-GA/.test(e)));

  const empty = tripIncome.computeTripIncome({}, routeKmTable, opts);
  assert.deepEqual(empty.legs, []);
  assert.ok(empty.errors.length >= 2);
});

test('rateValueForMonth falls back to Base before the first month and to the latest month after the last', () => {
  const table = fakeRateTable('tn-18mt');
  assert.deepEqual(rateTables.rateValueForMonth(table, 'km-0-50', '2025-01'), { value: 598.9932, month: 'base' });
  assert.equal(rateTables.rateValueForMonth(table, 'km-0-50', '2026-10').month, '2026-10');
  assert.equal(rateTables.rateValueForMonth(table, 'km-0-50', '2030-01').month, table.months[table.months.length - 1]);
  assert.deepEqual(rateTables.rateValueForMonth(table, 'nope', '2026-10'), { value: null, month: null });
});
