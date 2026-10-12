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

test('twelve tables are configured (six states x 18MT / 21MT), all Sep-25; 18MT runs 3.2 km/L, 21MT 3.0 km/L; TN and KA 18MT keep their bases', () => {
  assert.deepEqual(RATE_TABLES.map((t) => t.id), [
    'tn-18mt', 'ka-18mt', 'ap-18mt', 'kl-18mt', 'py-18mt', 'ts-18mt',
    'tn-21mt', 'ka-21mt', 'ap-21mt', 'kl-21mt', 'py-21mt', 'ts-21mt',
  ]);
  RATE_TABLES.forEach((t) => {
    assert.deepEqual([t.startMonth, t.kmPerLitre], ['2025-09', t.tonnage === 21 ? 3.0 : 3.2], t.id);
    assert.ok([18, 21].includes(t.tonnage), t.id);
    assert.equal(t.title, `Rate/KM/Ton - ${t.stateCode} (${t.tonnage}MT)`);
    assert.equal(t.rows.length, 11, t.id);
    // the 18MT and 21MT tables of a state share its diesel column and reference month
    const sibling = RATE_TABLES.find((o) => o.stateCode === t.stateCode && o.tonnage !== t.tonnage);
    assert.deepEqual([sibling.dieselState, sibling.baseDieselMonth], [t.dieselState, t.baseDieselMonth], t.id);
    assert.equal(t.baseDieselPrice, undefined, t.id);
  });
  assert.equal(TN.title, 'Rate/KM/Ton - TN (18MT)');
  assert.equal(TN.stateCode, 'TN');
  assert.deepEqual([TN.dieselState, TN.baseDieselMonth, TN.startMonth, TN.kmPerLitre, TN.tonnage], ['Tamil Nadu', '2024-12', '2025-09', 3.2, 18]);
  assert.equal(KA.title, 'Rate/KM/Ton - KA (18MT)');
  assert.equal(KA.stateCode, 'KA');
  assert.deepEqual([KA.dieselState, KA.baseDieselMonth, KA.startMonth, KA.kmPerLitre, KA.tonnage], ['Karnataka', '2024-12', '2025-09', 3.2, 18]);
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

test('AP, KL, PY and TS tables use their state diesel column with the Dec-24 diesel as reference and the agreed bases', () => {
  const bases = (id) => rateTables.findConfig(id).rows.map((row) => row.base);
  const meta = (id) => { const t = rateTables.findConfig(id); return [t.dieselState, t.baseDieselMonth]; };
  assert.deepEqual(meta('ap-18mt'), ['Andhra Pradesh', '2024-12']);
  assert.deepEqual(bases('ap-18mt'), [590.2854, 682.9283, 910.178, 1015.7877, 1114.3141, 1229.6147, 1347.0379, 1498.0855, 1705.9119, 3.6196, 3.6196]);
  assert.deepEqual(meta('kl-18mt'), ['Kerala', '2024-12']);
  assert.deepEqual(bases('kl-18mt'), [601.8373, 757.0615, 876.9278, 1047.9342, 1185.0142, 1345.3321, 1544.647, 1684.1075, 1814.6669, 3.7148, 3.7813]);
  assert.deepEqual(meta('py-18mt'), ['Pondicherry', '2024-12']);
  assert.deepEqual(bases('py-18mt'), [597.2566, 723.5159, 849.7752, 976.0344, 1102.2937, 1128.553, 1307.7125, 1422.8499, 1630.8807, 3.3887, 3.4552]);
  assert.deepEqual(meta('ts-18mt'), ['Telangana', '2024-12']);
  assert.deepEqual(bases('ts-18mt'), [591.7889, 690.2851, 914.4628, 1000.03, 1071.3447, 1147.1897, 1229.1878, 1475.0557, 1651.5726, 3.5901, 3.5901]);
});

test('21MT tables carry the agreed bases and divide diesel changes by 3.0 x 21', () => {
  const bases = (id) => rateTables.findConfig(id).rows.map((row) => row.base);
  assert.deepEqual(bases('tn-21mt'), [565.4635, 709.5435, 834.5169, 981.6259, 1072.5958, 1268.4966, 1334.8247, 1379.8988, 1557.6911, 3.3423, 3.4089]);
  assert.deepEqual(bases('ka-21mt'), [616.4855, 719.1994, 860.3903, 982.3428, 1159.9858, 1295.1566, 1403.8906, 1504.5566, 1614.381, 3.3547, 3.4212]);
  assert.deepEqual(bases('ap-21mt'), [569.4083, 653.6035, 861.76, 961.642, 1052.6625, 1159.1016, 1269.4887, 1407.1977, 1597.8497, 3.3697, 3.3697]);
  assert.deepEqual(bases('kl-21mt'), [582.805, 723.7365, 839.1508, 990.8377, 1116.6943, 1262.8597, 1445.0928, 1571.4723, 1691.2014, 3.4618, 3.5281]);
  assert.deepEqual(bases('py-21mt'), [549.9667, 664.9567, 779.9467, 904.8225, 1029.6983, 1134.8025, 1220.135, 1318.0584, 1529.2016, 3.1221, 3.1886]);
  assert.deepEqual(bases('ts-21mt'), [566.0891, 661.7278, 858.6775, 944.2867, 1009.2057, 1081.5852, 1156.964, 1379.9428, 1540.0929, 3.2971, 3.2971]);

  // Same diesel series: a +6.93 rise over the Dec-24 reference -> escalation 0.12 at 18 t (/ 57.6), 0.11 at 21 t (/ 63)
  const dieselCells = { '2024-12': { value: 92.39 }, '2025-09': { value: 92.39 }, '2025-10': { value: 99.32 } };
  const t18 = rateTables.computeRateTable(rateTables.findConfig('tn-18mt'), { dieselCells, now });
  const t21 = rateTables.computeRateTable(rateTables.findConfig('tn-21mt'), { dieselCells, now });
  assert.deepEqual([t18.params.kmPerLitre, t21.params.kmPerLitre], [3.2, 3.0]);
  assert.equal(rowByKey(t18, 'price-1-paise').values['2025-10'].value, 0.12); // 6.93 / 57.6 = 0.1203
  assert.equal(rowByKey(t21, 'price-1-paise').values['2025-10'].value, 0.11); // 6.93 / 63 = 0.11
  assert.equal(rowByKey(t18, 'price-escalation').values['2025-10'].value, 0.12);
  assert.equal(rowByKey(t21, 'price-escalation').values['2025-10'].value, 0.11);
  assert.equal(rowByKey(t21, 'normal-451').values['2025-10'].value, 3.4523); // 3.3423 + 0.11
  assert.equal(rowByKey(t21, 'km-0-50').values['2025-10'].value, 568.2135); // 565.4635 + 0.11 x 25
});

test('KM band multiplier is the band midpoint; 451 rows use 1', () => {
  assert.equal(rateTables.multiplierFor({ low: 0, high: 50 }), 25);
  assert.equal(rateTables.multiplierFor({ low: 51, high: 100 }), 75.5);
  assert.equal(rateTables.multiplierFor({ low: 401, high: 450 }), 425.5);
  assert.equal(rateTables.multiplierFor({ label: '451 Normal base' }), 1);
  assert.equal(rateTables.previousMonth('2026-01'), '2025-12');
  assert.equal(rateTables.previousMonth('2025-09'), '2025-08');
});

test('price rows divide the diesel difference by (3.2 x 18) with 2 decimals and are blank when data is missing', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2024-12': { value: 92.39 }, // Price Escalation reference
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
  assert.deepEqual([table.params.baseDieselMonth, table.params.baseDieselPrice], ['2024-12', 92.39]);
});

test('without a Dec-24 diesel value Price Escalation is blank and every row keeps its Base', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: { '2025-08': { value: 92.41 }, '2025-09': { value: 92.45 }, '2025-10': { value: 93.45 }, '2025-11': { value: 93.0 }, '2025-12': { value: 94.0 } },
  });
  assert.deepEqual([table.params.baseDieselMonth, table.params.baseDieselPrice], ['2024-12', null]);
  assert.deepEqual(Object.values(table.referenceDiesel), [null, null, null, null]);
  assert.deepEqual(rowByKey(table, 'price-1-paise').values['2025-10'].value, 0.02); // still calculated month on month
  Object.values(rowByKey(table, 'price-escalation').values).forEach((cell) => assert.equal(cell.value, null));
  Object.values(rowByKey(table, 'km-0-50').values).forEach((cell) => assert.deepEqual(cell, { value: 598.9932, carried: true, overridden: false, calculated: 598.9932 }));
  Object.values(rowByKey(table, 'normal-451').values).forEach((cell) => assert.equal(cell.value, 3.6087));
});

test('band and 451 rows recalculate from Base when |Price 1 paise| >= 0.01 (rise or fall), else carry the previous value', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2024-12': { value: 92.39 },
      '2025-08': { value: 92.41 },
      '2025-09': { value: 92.41 }, // unchanged -> 0.00 -> Base carried
      '2025-10': { value: 93.45 }, // +1.04 / 57.6 = 0.0181 -> recalculates
      '2025-11': { value: 92.80 }, // -0.65 / 57.6 = -0.0113 -> a fall of one paise also recalculates
      '2025-12': { value: 94.00 }, // +1.20 / 57.6 = 0.0208 -> recalculates from Base (not cumulative)
    },
  });
  const p1 = rowByKey(table, 'price-1-paise').values;
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value, p1['2025-11'].value, p1['2025-12'].value], [0, 0.02, -0.01, 0.02]);
  assert.ok(Math.abs(p1['2025-10'].exact - 1.04 / 57.6) < 1e-9); // exact value kept alongside the 2 dp display value
  const esc = rowByKey(table, 'price-escalation').values;
  // exact: 1.06 / 57.6 = 0.018403 ; 0.41 / 57.6 = 0.007118 ; 1.61 / 57.6 = 0.027951
  assert.deepEqual([esc['2025-10'].value, esc['2025-11'].value, esc['2025-12'].value], [0.02, 0.01, 0.03]);

  const band0 = rowByKey(table, 'km-0-50');
  assert.equal(band0.multiplier, 25);
  assert.deepEqual(band0.values, {
    '2025-09': { value: 598.9932, carried: true, overridden: false, calculated: 598.9932 },
    '2025-10': { value: 599.4533, carried: false, overridden: false, calculated: 599.4533 }, // 598.9932 + 0.018403 * 25
    '2025-11': { value: 599.1712, carried: false, overridden: false, calculated: 599.1712 }, // 598.9932 + 0.007118 * 25
    '2025-12': { value: 599.692, carried: false, overridden: false, calculated: 599.692 }, // 598.9932 + 0.027951 * 25
  });
  assert.equal(rowByKey(table, 'km-401-450').values['2025-10'].value, 1681.4363); // 1673.6059 + 0.018403 * 425.5
  assert.deepEqual(rowByKey(table, 'normal-451').values['2025-11'], { value: 3.6158, carried: false, overridden: false, calculated: 3.6158 }); // 3.6087 + 0.007118
  assert.deepEqual(rowByKey(table, 'mangalore-451').values['2025-12'], { value: 3.7032, carried: false, overridden: false, calculated: 3.7032 }); // 3.6752 + 0.027951
});

test('the spreadsheet example: 151~200 uses the exact Price Escalation, not the 2 dp display value', () => {
  const table = rateTables.computeRateTable(TN, {
    now: new Date('2026-06-15T06:00:00Z'),
    dieselCells: { '2024-12': { value: 92.41 }, '2026-04': { value: 92.41 }, '2026-05': { value: 95.22 }, '2026-06': { value: 99.55 } },
  });
  const band = rowByKey(table, 'km-151-200').values;
  const esc = rowByKey(table, 'price-escalation').values;
  assert.equal(esc['2026-05'].value, 0.05); // displayed
  assert.ok(Math.abs(esc['2026-05'].exact - 2.81 / 57.6) < 1e-9); // 0.048785 used in the rows below
  assert.equal(band['2026-04'].value, 1049.8361);
  assert.equal(band['2026-05'].value, 1058.3978); // 1049.8361 + (95.22 - 92.41) / 57.6 x 175.5 (not 1058.6111 from 0.05 x 175.5)
  assert.equal(band['2026-06'].value, 1071.5908); // 1049.8361 + (99.55 - 92.41) / 57.6 x 175.5
});

test('a change below one exact paise carries forward; one exact paise or more (up or down) recalculates', () => {
  const table = rateTables.computeRateTable(TN, {
    now,
    dieselCells: {
      '2024-12': { value: 92.39 },
      '2025-08': { value: 100.00 },
      '2025-09': { value: 100.60 }, // +0.60 / 57.6 = 0.0104 -> recalculates
      '2025-10': { value: 100.40 }, // -0.20 / 57.6 = -0.0035 -> carried
      '2025-11': { value: 99.60 }, // -0.80 / 57.6 = -0.0139 -> recalculates
      // 2025-12 missing -> carried
    },
  });
  const p1 = rowByKey(table, 'price-1-paise').values;
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value, p1['2025-11'].value, p1['2025-12'].value], [0.01, -0, -0.01, null]);
  const band = rowByKey(table, 'km-51-100').values;
  // esc Sep = (100.60 - 92.39) / 57.6 = 0.142535 ; Nov = (99.60 - 92.39) / 57.6 = 0.125174
  assert.deepEqual(band['2025-09'], { value: 766.9976, carried: false, overridden: false, calculated: 766.9976 }); // 756.2362 + 0.142535 * 75.5
  assert.deepEqual(band['2025-10'], { value: 766.9976, carried: true, overridden: false, calculated: 766.9976 });
  assert.deepEqual(band['2025-11'], { value: 765.6868, carried: false, overridden: false, calculated: 765.6868 }); // 756.2362 + 0.125174 * 75.5
  assert.deepEqual(band['2025-12'], { value: 765.6868, carried: true, overridden: false, calculated: 765.6868 });
});

test('a change that displays as 0.01 but is below one exact paise does not recalculate; exactly one paise does', () => {
  const t18 = rateTables.computeRateTable(TN, {
    now,
    dieselCells: { '2024-12': { value: 92.39 }, '2025-08': { value: 100 }, '2025-09': { value: 100.40 }, '2025-10': { value: 100.98 } },
  });
  const p1 = rowByKey(t18, 'price-1-paise').values;
  assert.deepEqual([p1['2025-09'].value, p1['2025-10'].value], [0.01, 0.01]); // 0.40 / 57.6 = 0.0069 and 0.58 / 57.6 = 0.0101 both display as 0.01
  assert.equal(rowByKey(t18, 'km-0-50').values['2025-09'].carried, true);
  assert.equal(rowByKey(t18, 'km-0-50').values['2025-10'].carried, false);

  // 21MT: 0.63 / 63 is exactly one paise despite floating-point noise
  const t21 = rateTables.computeRateTable(rateTables.findConfig('tn-21mt'), {
    now,
    dieselCells: { '2024-12': { value: 92.39 }, '2025-08': { value: 92.41 }, '2025-09': { value: 93.04 } },
  });
  assert.equal(rowByKey(t21, 'km-0-50').values['2025-09'].carried, false);
});

test('the KA table uses Karnataka diesel, its Dec-24 reference and its own base values', () => {
  const table = rateTables.computeRateTable(KA, {
    now,
    dieselCells: {
      '2024-12': { value: 88.94 },
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
  // (91.45 - 88.94) / 57.6 = 0.043576 -> shows 0.04 ; (92.60 - 88.94) / 57.6 = 0.063542 -> shows 0.06
  assert.deepEqual([esc['2025-09'].value, esc['2025-10'].value], [0.04, 0.06]);

  const band0 = rowByKey(table, 'km-0-50');
  assert.equal(band0.base, 642.6849);
  assert.deepEqual(band0.values['2025-09'], { value: 642.6849, carried: true, overridden: false, calculated: 642.6849 });
  assert.deepEqual(band0.values['2025-10'], { value: 644.2734, carried: false, overridden: false, calculated: 644.2734 }); // 642.6849 + 0.063542 * 25
  assert.deepEqual(rowByKey(table, 'km-401-450').values['2025-10'], { value: 1758.4549, carried: false, overridden: false, calculated: 1758.4549 }); // 1731.4179 + 0.063542 * 425.5
  assert.deepEqual(rowByKey(table, 'normal-451').values['2025-10'], { value: 3.6867, carried: false, overridden: false, calculated: 3.6867 }); // 3.6232 + 0.063542
  assert.deepEqual(rowByKey(table, 'mangalore-451').values['2025-10'], { value: 3.7532, carried: false, overridden: false, calculated: 3.7532 }); // 3.6897 + 0.063542
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

  const table = rateTables.computeRateTable(TN, { now, bases, dieselCells: { '2024-12': { value: 92.39 }, '2025-08': { value: 92 }, '2025-09': { value: 93.45 } } });
  const band = rowByKey(table, 'km-0-50');
  assert.equal(band.base, 600.1235);
  assert.equal(band.defaultBase, 598.9932);
  assert.equal(band.values['2025-09'].value, 600.5836); // Price 1 paise 1.45/57.6 = 0.0252 ; escalation 1.06/57.6 = 0.018403 ; 600.1235 + 0.018403 * 25
});

test('manual month values replace the calculated figure, are carried into later months and can be cleared', () => {
  const dieselCells = {
    '2024-12': { value: 92.39 },
    '2025-08': { value: 100.00 },
    '2025-09': { value: 100.60 }, // recalculates
    '2025-10': { value: 100.40 }, // carried
    '2025-11': { value: 99.60 }, // recalculates
  };
  const plain = rateTables.computeRateTable(TN, { now, dieselCells });
  const edited = rateTables.computeRateTable(TN, { now, dieselCells, cells: { 'km-51-100': { '2025-09': 770 } } });
  const band = rowByKey(edited, 'km-51-100').values;
  assert.deepEqual(band['2025-09'], { value: 770, carried: false, overridden: true, calculated: 766.9976 });
  assert.deepEqual(band['2025-10'], { value: 770, carried: true, overridden: false, calculated: 770 }); // carried from the manual value
  assert.deepEqual(band['2025-11'], rowByKey(plain, 'km-51-100').values['2025-11']); // a recalculating month ignores it
  // other rows untouched
  assert.deepEqual(rowByKey(edited, 'km-0-50').values, rowByKey(plain, 'km-0-50').values);
  // Trip Income reads the manual value for that month
  assert.equal(rateTables.rateValueForMonth(edited, 'km-51-100', '2025-09').value, 770);

  // applyCellEdits validates and merges; null clears
  const next = rateTables.applyCellEdits(null, { 'km-51-100': { '2025-09': '770', '2025-10': 775.12345 } }, TN);
  assert.deepEqual(next, { 'km-51-100': { '2025-09': 770, '2025-10': 775.1235 } });
  assert.deepEqual(rateTables.applyCellEdits(next, { 'km-51-100': { '2025-09': null } }, TN), { 'km-51-100': { '2025-10': 775.1235 } });
  assert.deepEqual(rateTables.applyCellEdits(next, { 'km-51-100': { '2025-09': '', '2025-10': null } }, TN), {});
  assert.throws(() => rateTables.applyCellEdits(null, { 'nope': { '2025-09': 1 } }, TN), /Unknown row/);
  assert.throws(() => rateTables.applyCellEdits(null, { 'km-51-100': { '2025-08': 1 } }, TN), /Invalid month/);
  assert.throws(() => rateTables.applyCellEdits(null, { 'km-51-100': { '2025-09': -1 } }, TN), /Invalid value/);
  assert.throws(() => rateTables.applyCellEdits(null, { 'price-1-paise': { '2025-09': 1 } }, TN), /Unknown row/);
  // stored garbage is ignored rather than breaking the table
  assert.deepEqual(rateTables.normalizeCells({ 'km-51-100': { 'bad': 1, '2025-09': 'x', '2025-10': 5 }, zzz: {} }, TN), { 'km-51-100': { '2025-10': 5 } });
});

test('every table is scheduled for a 3.5% Base revision on Sep-28 and Sep-29', () => {
  RATE_TABLES.forEach((t) => {
    assert.deepEqual(t.baseRevisions, [{ month: '2028-09', rate: 0.035 }, { month: '2029-09', rate: 0.035 }], t.id);
  });
  assert.equal(rateTables.averageKmFor({ low: 0, high: 50 }), 25);
  assert.equal(rateTables.averageKmFor({ low: 401, high: 450 }), 425.5);
  assert.equal(rateTables.averageKmFor({ label: '451 Normal base' }), 1);
});

// Diesel series helper: `value` for the Dec-24 reference and every month from 2025-08 up to `until`, then the given overrides.
function dieselSeries(value, until, overrides = {}) {
  const cells = { '2024-12': { value } };
  let month = '2025-08';
  while (month <= until) {
    cells[month] = { value };
    const [y, m] = month.split('-').map(Number);
    month = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  }
  Object.entries(overrides).forEach(([k, v]) => { cells[k] = v === null ? undefined : { value: v }; });
  return cells;
}

test('Sep-28 and Sep-29 revise Base to R + (R - F) x 3.5% from the August value and reset the escalation reference to August diesel', () => {
  const later = new Date('2029-10-15T06:00:00Z');
  const dieselCells = dieselSeries(92.39, '2028-07', {
    '2028-08': 98.15, // +5.76 -> 0.10 -> recalculates: this is R for the Sep-28 revision
    '2028-09': 98.15, // unchanged diesel, but the revision month always recalculates from the new Base
    '2028-10': 99.30, // +1.15 -> 0.02 against the new 98.15 reference
  });
  for (let y = 2028, m = 11; `${y}-${String(m).padStart(2, '0')}` <= '2029-09';) {
    dieselCells[`${y}-${String(m).padStart(2, '0')}`] = { value: 99.30 };
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  dieselCells['2029-10'] = { value: 100.50 }; // +1.20 -> 0.02 against the 99.30 reference

  const table = rateTables.computeRateTable(TN, { now: later, dieselCells });
  assert.deepEqual(table.params.baseRevisions, [{ month: '2028-09', rate: 0.035 }, { month: '2029-09', rate: 0.035 }]);
  assert.deepEqual(table.revisions, {
    '2028-09': { scheduledMonth: '2028-09', rate: 0.035, dieselMonth: '2028-08', dieselPrice: 98.15 },
    '2029-09': { scheduledMonth: '2029-09', rate: 0.035, dieselMonth: '2029-08', dieselPrice: 99.30 },
  });
  assert.deepEqual(
    [table.referenceDiesel['2028-08'], table.referenceDiesel['2028-09'], table.referenceDiesel['2029-08'], table.referenceDiesel['2029-09']],
    [92.39, 98.15, 98.15, 99.30],
  );

  const esc = rowByKey(table, 'price-escalation').values;
  // Aug-28 still against 92.39: (98.15 - 92.39) / 57.6 = 0.10 ; from Sep-28 against 98.15: 0.00 then (99.30 - 98.15) / 57.6 = 0.02
  assert.deepEqual([esc['2028-08'].value, esc['2028-09'].value, esc['2028-10'].value], [0.10, 0, 0.02]);
  // Oct-29 against 99.30: (100.50 - 99.30) / 57.6 = 0.02 (it would be 0.14 against the original 92.39)
  assert.equal(esc['2029-10'].value, 0.02);

  const band0 = rowByKey(table, 'km-0-50');
  assert.equal(band0.averageKm, 25);
  assert.equal(band0.base, 598.9932); // the editable Base column keeps the original value
  assert.deepEqual(band0.values['2028-08'], { value: 601.4932, carried: false, overridden: false, calculated: 601.4932 }); // 598.9932 + 0.10 x 25
  // R = 601.4932 ; F = 25 x 98.15 / 57.6 = 42.5998 ; Nr = (R - F) x 0.035 = 19.5613 ; new Base = 621.0545
  assert.deepEqual(band0.values['2028-09'], {
    value: 621.0545, carried: false, overridden: false, calculated: 621.0545,
    revision: { base: 621.0545, previousValue: 601.4932, fuel: 42.5998, increment: 19.5613, rate: 0.035, dieselMonth: '2028-08', dieselPrice: 98.15 },
  });
  assert.equal(band0.values['2028-10'].value, 621.5536); // 621.0545 + (1.15 / 57.6 = 0.019965) x 25 (new Base, new reference)
  assert.deepEqual(band0.values['2029-08'], { value: 621.5536, carried: true, overridden: false, calculated: 621.5536 });
  // R = 621.5536 ; F = 25 x 99.30 / 57.6 = 43.0990 ; Nr = 20.2459 ; new Base = 641.7995
  assert.equal(band0.values['2029-09'].value, 641.7995);
  assert.equal(band0.values['2029-09'].revision.base, 641.7995);
  assert.equal(band0.values['2029-10'].value, 642.3203); // 641.7995 + (1.20 / 57.6 = 0.020833) x 25
  assert.deepEqual(Object.keys(band0.revisions), ['2028-09', '2029-09']);
  assert.equal(band0.currentBase, 641.7995);

  const normal = rowByKey(table, 'normal-451');
  assert.equal(normal.averageKm, 1);
  assert.equal(normal.values['2028-08'].value, 3.7087); // 3.6087 + 0.10
  // R = 3.7087 ; F = 98.15 / 57.6 = 1.7040 ; Nr = (R - F) x 0.035 = 0.0702 ; new Base = 3.7789
  assert.equal(normal.values['2028-09'].value, 3.7789);
  assert.deepEqual(normal.values['2028-09'].revision, { base: 3.7789, previousValue: 3.7087, fuel: 1.704, increment: 0.0702, rate: 0.035, dieselMonth: '2028-08', dieselPrice: 98.15 });
  assert.equal(normal.values['2028-10'].value, 3.7989); // 3.7789 + 0.019965
  // R = 3.7989 ; F = 99.30 / 57.6 = 1.7240 ; Nr = 0.0726 ; new Base = 3.8715
  assert.equal(normal.values['2029-09'].value, 3.8715);
  assert.equal(normal.values['2029-10'].value, 3.8923); // 3.8715 + 0.020833
  assert.equal(normal.currentBase, 3.8715);

  // 21MT sibling: F divides by 3.0 x 21 = 63 and R comes from its own Base (3.3423 + 5.76 / 63)
  const t21 = rateTables.computeRateTable(rateTables.findConfig('tn-21mt'), { now: later, dieselCells });
  const n21 = rowByKey(t21, 'normal-451');
  assert.equal(n21.values['2028-08'].value, 3.4337); // (98.15 - 92.39) / 63 = 0.091429
  // R = 3.4337 ; F = 98.15 / 63 = 1.5579 ; Nr = 0.0657 ; new Base = 3.4994
  assert.equal(n21.values['2028-09'].value, 3.4994);
});

test('a manual August value feeds R; a missing August diesel falls back to the latest earlier month; months before Sep-28 are untouched', () => {
  const later = new Date('2028-10-15T06:00:00Z');
  const dieselCells = dieselSeries(92.39, '2028-10', { '2028-07': 98.15, '2028-08': null });
  const plain = rateTables.computeRateTable(TN, { now: later, dieselCells });
  // Jul-28 recalculates to 601.4932, Aug-28 has no diesel so it is carried; Sep-28 anchors on the Jul-28 diesel
  assert.deepEqual(plain.revisions['2028-09'], { scheduledMonth: '2028-09', rate: 0.035, dieselMonth: '2028-07', dieselPrice: 98.15 });
  assert.equal(rowByKey(plain, 'km-0-50').values['2028-08'].carried, true);
  assert.equal(rowByKey(plain, 'km-0-50').values['2028-09'].revision.base, 621.0545);
  // Sep-28 diesel is back at 92.39, a fall of 5.76 against the new 98.15 reference: escalation -0.10 -> 621.0545 - 2.5,
  // applied in the revision month itself (it always recalculates) and carried into Oct-28
  assert.equal(rowByKey(plain, 'price-escalation').values['2028-09'].value, -0.1);
  assert.deepEqual(rowByKey(plain, 'km-0-50').values['2028-09'].value, 618.5545);
  assert.deepEqual(rowByKey(plain, 'km-0-50').values['2028-10'], { value: 618.5545, carried: true, overridden: false, calculated: 618.5545 });

  const edited = rateTables.computeRateTable(TN, { now: later, dieselCells, cells: { 'km-0-50': { '2028-08': 700 } } });
  // R = 700 ; F = 42.5998 ; Nr = 23.0090 ; new Base = 723.0090 ; Sep-28 value = 723.0090 - 0.10 x 25
  assert.equal(rowByKey(edited, 'km-0-50').values['2028-09'].revision.base, 723.009);
  assert.equal(rowByKey(edited, 'km-0-50').values['2028-09'].value, 720.509);
  assert.equal(rowByKey(edited, 'km-0-50').values['2028-09'].revision.previousValue, 700);

  // nothing changes before the first revision month
  const before = rateTables.computeRateTable(TN, { now: new Date('2028-08-15T06:00:00Z'), dieselCells });
  assert.deepEqual(before.revisions, {});
  assert.deepEqual(rowByKey(before, 'km-0-50').values['2028-07'], rowByKey(plain, 'km-0-50').values['2028-07']);
  Object.values(rowByKey(before, 'km-0-50').values).forEach((cell) => assert.equal(cell.revision, undefined));
});

test('a table without a revision schedule keeps the original reference and Base throughout', () => {
  const later = new Date('2029-10-15T06:00:00Z');
  const config = { ...TN, baseRevisions: undefined };
  const table = rateTables.computeRateTable(config, { now: later, dieselCells: dieselSeries(98.15, '2029-10') });
  assert.deepEqual(table.revisions, {});
  assert.deepEqual(table.params.baseRevisions, []);
  assert.equal(table.referenceDiesel['2029-10'], 98.15); // the Dec-24 diesel of the series
  assert.equal(rowByKey(table, 'km-0-50').currentBase, 598.9932);
});

test('recalculateAllRateTables clears every manual month value in every table, keeps Base edits and returns the fresh list', async (t) => {
  const settings = require('../src/utils/settings');
  const dieselPrices = require('../src/utils/dieselPrices');
  const dieselCells = {
    '2024-12': { value: 92.39 },
    '2025-08': { value: 100.00 },
    '2025-09': { value: 100.60 },
    '2025-10': { value: 100.40 },
    '2025-11': { value: 99.60 },
  };
  const stateCells = Object.fromEntries(RATE_TABLES.map((c) => [c.dieselState, dieselCells]));
  let storedCells = { 'tn-18mt': { 'km-51-100': { '2025-09': 770 } }, 'ka-21mt': { 'normal-451': { '2025-10': 9 } } };
  const storedBases = { 'tn-18mt': { 'km-0-50': 600 } };
  t.mock.method(dieselPrices, 'getTable', () => ({ cells: stateCells }));
  t.mock.method(settings, 'getRateTableBases', (id) => storedBases[id] || null);
  t.mock.method(settings, 'getRateTableCells', (id) => storedCells[id] || null);
  const clear = t.mock.method(settings, 'clearRateTableCells', async () => { storedCells = {}; return {}; });

  const before = rateTables.getRateTable('tn-18mt', { now });
  assert.equal(rowByKey(before, 'km-51-100').values['2025-09'].overridden, true);

  const after = await rateTables.recalculateAllRateTables({ now });
  assert.equal(clear.mock.callCount(), 1);
  assert.equal(after.length, RATE_TABLES.length);
  after.forEach((table) => {
    table.rows.forEach((row) => {
      Object.values(row.values).forEach((cell) => assert.notEqual(cell.overridden, true, `${table.id} ${row.key}`));
    });
  });
  const tn = after.find((table) => table.id === 'tn-18mt');
  assert.equal(rowByKey(tn, 'km-51-100').values['2025-09'].value, 766.9976); // calculated again
  assert.equal(rowByKey(tn, 'km-0-50').base, 600); // Base edit kept
  assert.deepEqual(storedCells, {});
});
