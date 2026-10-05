const test = require('node:test');
const assert = require('node:assert/strict');

const rateTables = require('../src/utils/rateTables');
const { RATE_TABLES } = require('../src/config/constants');

const now = new Date('2025-12-15T06:00:00Z'); // Sep-25 .. Dec-25 columns
const TN = rateTables.findConfig('tn-18mt');
const KA = rateTables.findConfig('ka-18mt');

function rowByKey(table, key) {
  return table.rows.find((row) => row.key === key);
}

test('twelve tables are configured (six states x 18MT / 21MT), all Sep-25 / 3.2 km/L; TN and KA 18MT keep their bases', () => {
  assert.deepEqual(RATE_TABLES.map((t) => t.id), [
    'tn-18mt', 'ka-18mt', 'ap-18mt', 'kl-18mt', 'py-18mt', 'ts-18mt',
    'tn-21mt', 'ka-21mt', 'ap-21mt', 'kl-21mt', 'py-21mt', 'ts-21mt',
  ]);
  RATE_TABLES.forEach((t) => {
    assert.deepEqual([t.startMonth, t.kmPerLitre], ['2025-09', 3.2], t.id);
    assert.ok([18, 21].includes(t.tonnage), t.id);
    assert.equal(t.title, `Rate/KM/Ton - ${t.stateCode} (${t.tonnage}MT)`);
    assert.equal(t.rows.length, 11, t.id);
    // the 18MT and 21MT tables of a state share its diesel column and reference price
    const sibling = RATE_TABLES.find((o) => o.stateCode === t.stateCode && o.tonnage !== t.tonnage);
    assert.deepEqual([sibling.dieselState, sibling.baseDieselPrice], [t.dieselState, t.baseDieselPrice], t.id);
  });
  assert.equal(TN.title, 'Rate/KM/Ton - TN (18MT)');
  assert.equal(TN.stateCode, 'TN');
  assert.deepEqual([TN.dieselState, TN.baseDieselPrice, TN.startMonth, TN.kmPerLitre, TN.tonnage], ['Tamil Nadu', 92.39, '2025-09', 3.2, 18]);
  assert.equal(KA.title, 'Rate/KM/Ton - KA (18MT)');
  assert.equal(KA.stateCode, 'KA');
  assert.deepEqual([KA.dieselState, KA.baseDieselPrice, KA.startMonth, KA.kmPerLitre, KA.tonnage], ['Karnataka', 88.94, '2025-09', 3.2, 18]);
  assert.deepEqual(TN.rows.map((row) => `${row.label}=${row.base}`), [
    '0~50=598.9932', '51~100=756.2362', '101~150=890.8584', '151~200=1049.8361', '201~250=1148.6741',
    '251~300=1361.2202', '301~350=1433.0686', '351~400=1479.1682', '401~450=1673.6059',
    '451 Normal base=3.6087', '451 Mangalore base=3.6752',
  ]);
  assert.deepEqual(KA.rows.map((row) => `${row.label}=${row.base}`), [
    '0~50=642.6849', '51~100=754.3992', '101~150=908.4959', '151~200=1041.4014', '201~250=1238.0294',
    '251~300=1387.1469', '301~350=1503.8404', '351~400=1614.2731', '401~450=1731.4179',
    '451 Normal base=3.6232', '451 Mangalore base=3.6897',
  ]);
  assert.equal(rateTables.findConfig('nope'), null);
});

test('AP, KL, PY and TS tables use their state diesel column with the Sep-25 average as reference and the agreed bases', () => {
  const bases = (id) => rateTables.findConfig(id).rows.map((row) => row.base);
  const meta = (id) => { const t = rateTables.findConfig(id); return [t.dieselState, t.baseDieselPrice]; };
  assert.deepEqual(meta('ap-18mt'), ['Andhra Pradesh', 97.48]);
  assert.deepEqual(bases('ap-18mt'), [590.2854, 682.9283, 910.178, 1015.7877, 1114.3141, 1229.6147, 1347.0379, 1498.0855, 1705.9119, 3.6196, 3.6196]);
  assert.deepEqual(meta('kl-18mt'), ['Kerala', 96.37]);
  assert.deepEqual(bases('kl-18mt'), [601.8373, 757.0615, 876.9278, 1047.9342, 1185.0142, 1345.3321, 1544.647, 1684.1075, 1814.6669, 3.7148, 3.7813]);
  assert.deepEqual(meta('py-18mt'), ['Pondicherry', 86.5]);
  assert.deepEqual(bases('py-18mt'), [597.2566, 723.5159, 849.7752, 976.0344, 1102.2937, 1128.553, 1307.7125, 1422.8499, 1630.8807, 3.3887, 3.4552]);
  assert.deepEqual(meta('ts-18mt'), ['Telangana', 95.7]);
  assert.deepEqual(bases('ts-18mt'), [591.7889, 690.2851, 914.4628, 1000.03, 1071.3447, 1147.1897, 1229.1878, 1475.0557, 1651.5726, 3.5901, 3.5901]);
});

test('21MT tables carry the agreed bases and divide diesel changes by 3.2 x 21', () => {
  const bases = (id) => rateTables.findConfig(id).rows.map((row) => row.base);
  assert.deepEqual(bases('tn-21mt'), [565.4635, 709.5435, 834.5169, 981.6259, 1072.5958, 1268.4966, 1334.8247, 1379.8988, 1557.6911, 3.3423, 3.4089]);
  assert.deepEqual(bases('ka-21mt'), [616.4855, 719.1994, 860.3903, 982.3428, 1159.9858, 1295.1566, 1403.8906, 1504.5566, 1614.381, 3.3547, 3.4212]);
  assert.deepEqual(bases('ap-21mt'), [569.4083, 653.6035, 861.76, 961.642, 1052.6625, 1159.1016, 1269.4887, 1407.1977, 1597.8497, 3.3697, 3.3697]);
  assert.deepEqual(bases('kl-21mt'), [582.805, 723.7365, 839.1508, 990.8377, 1116.6943, 1262.8597, 1445.0928, 1571.4723, 1691.2014, 3.4618, 3.5281]);
  assert.deepEqual(bases('py-21mt'), [549.9667, 664.9567, 779.9467, 904.8225, 1029.6983, 1134.8025, 1220.135, 1318.0584, 1529.2016, 3.1221, 3.1886]);
  assert.deepEqual(bases('ts-21mt'), [566.0891, 661.7278, 858.6775, 944.2867, 1009.2057, 1081.5852, 1156.964, 1379.9428, 1540.0929, 3.2971, 3.2971]);

  // Same diesel series: a +6.72 rise over the TN reference -> escalation 0.12 at 18 t, 0.10 at 21 t
  const dieselCells = { '2025-09': { value: 92.39 }, '2025-10': { value: 99.11 } };
  const t18 = rateTables.computeRateTable(rateTables.findConfig('tn-18mt'), { dieselCells, now });
  const t21 = rateTables.computeRateTable(rateTables.findConfig('tn-21mt'), { dieselCells, now });
  assert.equal(rowByKey(t18, 'price-escalation').values['2025-10'].value, 0.12); // 6.72 / 57.6
  assert.equal(rowByKey(t21, 'price-escalation').values['2025-10'].value, 0.1); // 6.72 / 67.2
  assert.equal(rowByKey(t21, 'normal-451').values['2025-10'].value, 3.4423); // 3.3423 + 0.10
  assert.equal(rowByKey(t21, 'km-0-50').values['2025-10'].value, 566.7135); // 565.4635 + 0.10 x 12.5
});

test('KM band multiplier is the band midpoint divided by two; 451 rows use 1', () => {
  assert.equal(rateTables.multiplierFor({ low: 0, high: 50 }), 12.5);
  assert.equal(rateTables.multiplierFor({ low: 51, high: 100 }), 37.75);
  assert.equal(rateTables.multiplierFor({ low: 401, high: 450 }), 212.75);
  assert.equal(rateTables.multiplierFor({ label: '451 Normal base' }), 1);
  assert.equal(rateTables.previousMonth('2026-01'), '2025-12');
  assert.equal(rateTables.previousMonth('2025-09'), '2025-08');
});

test('price rows divide the diesel difference by (3.2 x 18) with 2 decimals and are blank when data is missing', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2025-08': { value: 92.41 },
      '2025-09': { value: 92.45 },
      '2025-10': { value: 93.45 },
      // 2025-11 missing
      '2025-12': { value: 92.53 },
    },
  });
  assert.equal(table.id, 'tn-18mt');
  assert.deepEqual(table.months, ['2025-09', '2025-10', '2025-11', '2025-12']);
  assert.deepEqual(table.dieselValues, { '2025-09': 92.45, '2025-10': 93.45, '2025-11': null, '2025-12': 92.53 });

  const p1 = rowByKey(table, 'price-1-paise').values;
  // (92.45 - 92.41) / 57.6 = 0.0007 -> 0.00 ; (93.45 - 92.45) / 57.6 = 0.01736 -> 0.02
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value, p1['2025-11'].value, p1['2025-12'].value], [0, 0.02, null, null]);

  const esc = rowByKey(table, 'price-escalation').values;
  // (92.45 - 92.39) / 57.6 -> 0.00 ; (93.45 - 92.39) / 57.6 = 0.01840 -> 0.02 ; (92.53 - 92.39) / 57.6 -> 0.00
  assert.deepEqual([esc['2025-09'].value, esc['2025-10'].value, esc['2025-11'].value, esc['2025-12'].value], [0, 0.02, null, 0]);
});

test('band and 451 rows recalculate from Base when |Price 1 paise| >= 0.01 (rise or fall), else carry the previous value', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2025-08': { value: 92.41 },
      '2025-09': { value: 92.41 }, // unchanged -> 0.00 -> Base carried
      '2025-10': { value: 93.45 }, // +1.04 -> 0.02 -> recalculates
      '2025-11': { value: 93.00 }, // -0.45 -> -0.01 -> a fall of one paise also recalculates
      '2025-12': { value: 94.00 }, // +1.00 -> 0.02 -> recalculates from Base (not cumulative)
    },
  });
  const p1 = rowByKey(table, 'price-1-paise').values;
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value, p1['2025-11'].value, p1['2025-12'].value], [0, 0.02, -0.01, 0.02]);
  const esc = rowByKey(table, 'price-escalation').values;
  assert.deepEqual([esc['2025-10'].value, esc['2025-11'].value, esc['2025-12'].value], [0.02, 0.01, 0.03]);

  const band0 = rowByKey(table, 'km-0-50');
  assert.equal(band0.multiplier, 12.5);
  assert.deepEqual(band0.values, {
    '2025-09': { value: 598.9932, carried: true },
    '2025-10': { value: 599.2432, carried: false }, // 598.9932 + 0.02 * 12.5
    '2025-11': { value: 599.1182, carried: false }, // 598.9932 + 0.01 * 12.5
    '2025-12': { value: 599.3682, carried: false }, // 598.9932 + 0.03 * 12.5
  });
  assert.equal(rowByKey(table, 'km-401-450').values['2025-10'].value, 1677.8609); // 1673.6059 + 0.02 * 212.75
  assert.deepEqual(rowByKey(table, 'normal-451').values['2025-11'], { value: 3.6187, carried: false }); // 3.6087 + 0.01
  assert.deepEqual(rowByKey(table, 'mangalore-451').values['2025-12'], { value: 3.7052, carried: false }); // 3.6752 + 0.03
});

test('a small change that rounds to 0.00 carries forward; a change that rounds to +/-0.01 recalculates', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2025-08': { value: 100.00 },
      '2025-09': { value: 100.60 }, // +0.60 -> 0.0104 -> 0.01 -> recalculates
      '2025-10': { value: 100.40 }, // -0.20 -> -0.0035 -> 0.00 -> carried
      '2025-11': { value: 99.60 }, // -0.80 -> -0.0139 -> -0.01 -> recalculates
      // 2025-12 missing -> carried
    },
  });
  const p1 = rowByKey(table, 'price-1-paise').values;
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value, p1['2025-11'].value, p1['2025-12'].value], [0.01, -0, -0.01, null]);
  const band = rowByKey(table, 'km-51-100').values;
  // esc Sep = (100.60 - 92.39) / 57.6 = 0.14253 -> 0.14 ; Nov = (99.60 - 92.39) / 57.6 = 0.12517 -> 0.13
  assert.deepEqual(band['2025-09'], { value: 761.5212, carried: false }); // 756.2362 + 0.14 * 37.75
  assert.deepEqual(band['2025-10'], { value: 761.5212, carried: true });
  assert.deepEqual(band['2025-11'], { value: 761.1437, carried: false }); // 756.2362 + 0.13 * 37.75
  assert.deepEqual(band['2025-12'], { value: 761.1437, carried: true });
});

test('the KA table uses Karnataka diesel, the 88.94 reference and its own base values', () => {
  const table = rateTables.computeRateTable(KA, {
    now,
    dieselCells: {
      '2025-08': { value: 91.47 },
      '2025-09': { value: 91.45 }, // -0.02 -> 0.00 -> carried
      '2025-10': { value: 92.60 }, // +1.15 -> 0.02 -> recalculates
    },
  });
  assert.equal(table.id, 'ka-18mt');
  assert.equal(table.title, 'Rate/KM/Ton - KA (18MT)');
  assert.equal(table.dieselState, 'Karnataka');
  assert.equal(table.params.baseDieselPrice, 88.94);

  const esc = rowByKey(table, 'price-escalation').values;
  // (91.45 - 88.94) / 57.6 = 0.04358 -> 0.04 ; (92.60 - 88.94) / 57.6 = 0.06354 -> 0.06
  assert.deepEqual([esc['2025-09'].value, esc['2025-10'].value], [0.04, 0.06]);

  const band0 = rowByKey(table, 'km-0-50');
  assert.equal(band0.base, 642.6849);
  assert.deepEqual(band0.values['2025-09'], { value: 642.6849, carried: true });
  assert.deepEqual(band0.values['2025-10'], { value: 643.4349, carried: false }); // 642.6849 + 0.06 * 12.5
  assert.deepEqual(rowByKey(table, 'km-401-450').values['2025-10'], { value: 1744.1829, carried: false }); // 1731.4179 + 0.06 * 212.75
  assert.deepEqual(rowByKey(table, 'normal-451').values['2025-10'], { value: 3.6832, carried: false }); // 3.6232 + 0.06
  assert.deepEqual(rowByKey(table, 'mangalore-451').values['2025-10'], { value: 3.7497, carried: false }); // 3.6897 + 0.06
});

test('base overrides are validated per table, rounded to 4 decimals and feed the calculation', () => {
  const bases = rateTables.applyBaseEdits(null, { 'km-0-50': '600.12345', 'normal-451': 4 }, TN);
  assert.equal(bases['km-0-50'], 600.1235);
  assert.equal(bases['normal-451'], 4);
  assert.equal(bases['km-51-100'], 756.2362); // untouched TN default
  assert.equal(rateTables.normalizeBases(null, KA)['km-51-100'], 754.3992); // KA default

  assert.throws(() => rateTables.applyBaseEdits(null, { nope: 1 }, TN), /Unknown row/);
  assert.throws(() => rateTables.applyBaseEdits(null, { 'km-0-50': -1 }, TN), /Invalid base/);
  assert.throws(() => rateTables.applyBaseEdits(null, { 'km-0-50': 'abc' }, TN), /Invalid base/);
  assert.throws(() => rateTables.applyBaseEdits(null, [], TN), /keyed by row/);

  const table = rateTables.computeRateTable(TN, { now, bases, dieselCells: { '2025-08': { value: 92 }, '2025-09': { value: 93.45 } } });
  const band = rowByKey(table, 'km-0-50');
  assert.equal(band.base, 600.1235);
  assert.equal(band.defaultBase, 598.9932);
  assert.equal(band.values['2025-09'].value, 600.3735); // Price 1 paise 1.45/57.6 -> 0.03 ; 600.1235 + 0.02 * 12.5
});
