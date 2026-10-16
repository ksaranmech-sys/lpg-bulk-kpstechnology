// Central place for enums so web + mobile clients can fetch them via
// GET /api/v1/meta and never hardcode dropdown values.

const LOADING_LOCATIONS = [];

const UNLOADING_LOCATIONS = [
  'Trichy',
  'Chengalpattu',
  'Madurai',
  'Manargudi',
  'Mayladuthurai',
  'Coimbatore',
  'Belgaum',
  'Shimoga',
  'Devanagunthi',
];

const ROUTE_KM_TABLE = [
  { loadingLocation: 'MRPL', corporation: 'KPS', unloadingLocation: 'Belgaum', km: 450 },
  { loadingLocation: 'AEGIS-Mangalore', corporation: 'KPS', unloadingLocation: 'Trichy', km: 620 },
  { loadingLocation: 'Total-Mangalore', corporation: 'KPS', unloadingLocation: 'Chengalpattu', km: 510 },
];

const ROLES = {
  SUPER_ADMIN: 'super_admin', // KPS Technology staff
  CUSTOMER_ADMIN: 'customer_admin', // full access to all vehicles under their customer/subgroup
  VEHICLE_USER: 'vehicle_user', // access limited to a single assigned vehicle
};

const TRIP_STATUS = {
  OPEN: 'open',
  PENDING_CLOSE: 'pending_close',
  CLOSED: 'closed',
};

// Super admin "Average Diesel Price" table: one row per state, priced from a single reference city.
// `fuelPriceTodayCity` / `fuelPriceTodayState` are the names used on fuelpricetoday.in;
// `v3carsState` / `v3carsDistrict` the matching names on v3cars.com. When the city has no price
// for a day/month the state-level price is used instead. Columns run from DIESEL_PRICE_START_MONTH
// to the current month (a new column appears automatically on the 1st of every month).
// `baseDieselPrice` is the agreed diesel price for DIESEL_PRICE_START_MONTH (Dec-24): it fills that
// column unless a value is entered manually, and is the Price Escalation reference of the
// Rate/KM/Ton tables.
const DIESEL_PRICE_ROWS = [
  { state: 'Andhra Pradesh', city: 'Amaravati', baseDieselPrice: 95.69, fuelPriceTodayCity: 'Amaravati', fuelPriceTodayState: 'Andhra Pradesh', v3carsState: 'Andhra Pradesh', v3carsDistrict: 'Amaravati' },
  { state: 'Karnataka', city: 'Bengaluru', baseDieselPrice: 91.14, fuelPriceTodayCity: 'Bengaluru', fuelPriceTodayState: 'Karnataka', v3carsState: 'Karnataka', v3carsDistrict: 'Bangalore' },
  { state: 'Kerala', city: 'Thiruvananthapuram', baseDieselPrice: 96.16, fuelPriceTodayCity: 'Thiruvananthapuram', fuelPriceTodayState: 'Kerala', v3carsState: 'Kerala', v3carsDistrict: 'Thiruvananthapuram' },
  { state: 'Pondicherry', city: 'Puducherry', baseDieselPrice: 84.48, fuelPriceTodayCity: 'Puducherry', fuelPriceTodayState: 'Puducherry (UT)', v3carsState: 'Pondicherry', v3carsDistrict: 'Pondicherry' },
  { state: 'Tamil Nadu', city: 'Chennai', baseDieselPrice: 92.41, fuelPriceTodayCity: 'Chennai', fuelPriceTodayState: 'Tamil Nadu', v3carsState: 'Tamil Nadu', v3carsDistrict: 'Chennai' },
  { state: 'Telangana', city: 'Hyderabad', baseDieselPrice: 92.44, fuelPriceTodayCity: 'Hyderabad', fuelPriceTodayState: 'Telangana', v3carsState: 'Telangana', v3carsDistrict: 'Hyderabad' },
];
const DIESEL_PRICE_START_MONTH = '2024-12';
const DIESEL_PRICE_MONTHLY_DEFAULTS = {
  'Andhra Pradesh': { '2025-11': 97.44, '2025-12': 97.47, '2026-01': 97.45, '2026-02': 97.48, '2026-03': 97.43, '2026-04': 97.50, '2026-05': 100.56, '2026-06': 105.28, '2026-07': 105.20, '2026-08': 105.20, '2026-09': 105.06 },
  Karnataka: { '2025-11': 91.46, '2025-12': 91.47, '2026-01': 91.46, '2026-02': 90.99, '2026-03': 91.00, '2026-04': 90.97, '2026-05': 94.00, '2026-06': 99.10, '2026-07': 99.27, '2026-08': 99.76, '2026-09': 99.35 },
  Kerala: { '2025-11': 96.42, '2025-12': 96.39, '2026-01': 96.42, '2026-02': 96.18, '2026-03': 96.32, '2026-04': 96.43, '2026-05': 99.55, '2026-06': 104.39, '2026-07': 104.14, '2026-08': 104.09, '2026-09': 104.29 },
  Pondicherry: { '2025-11': 86.50, '2025-12': 86.50, '2026-01': 86.49, '2026-02': 86.47, '2026-03': 86.48, '2026-04': 86.50, '2026-05': 89.33, '2026-06': 93.80, '2026-07': 94.96, '2026-08': 95.19, '2026-09': 94.00 },
  'Tamil Nadu': { '2025-11': 92.48, '2025-12': 92.53, '2026-01': 92.48, '2026-02': 92.48, '2026-03': 92.51, '2026-04': 92.54, '2026-05': 95.22, '2026-06': 99.57, '2026-07': 99.72, '2026-08': 100.04, '2026-09': 99.56 },
  Telangana: { '2025-11': 95.70, '2025-12': 95.70, '2026-01': 95.70, '2026-02': 95.70, '2026-03': 95.70, '2026-04': 95.70, '2026-05': 98.84, '2026-06': 103.84, '2026-07': 104.10, '2026-08': 103.95, '2026-09': 104.08 },
};
const DIESEL_PRICE_MONTHLY_MANUAL_DEFAULTS = {
  'Tamil Nadu': { '2026-02': 92.48 },
  Telangana: { '2026-02': 95.70 },
};

// Super admin "Rate/KM/Ton" tables (one per state), calculated from the Average Diesel Price table.
//   Price 1 paise      = (diesel[m] - diesel[m-1]) / (kmPerLitre * tonnage)
//   Price Escalation   = (diesel[m] - diesel[baseDieselMonth]) / (kmPerLitre * tonnage)
//   KM band            = base + escalation * multiplier   (multiplier = band midpoint, e.g. 0~50 -> 25)
//   451 rows           = base + escalation
// Band / 451 rows only recalculate when |Price 1 paise| >= 0.01 (rise or fall), otherwise the
// previous month's value is carried forward. Price rows are shown to 2 dp but used at full precision.
// `base` values are defaults; super admin can edit them in the UI.
const RATE_TABLE_ROW_DEFS = [
  { key: 'km-0-50', label: '0~50', low: 0, high: 50 },
  { key: 'km-51-100', label: '51~100', low: 51, high: 100 },
  { key: 'km-101-150', label: '101~150', low: 101, high: 150 },
  { key: 'km-151-200', label: '151~200', low: 151, high: 200 },
  { key: 'km-201-250', label: '201~250', low: 201, high: 250 },
  { key: 'km-251-300', label: '251~300', low: 251, high: 300 },
  { key: 'km-301-350', label: '301~350', low: 301, high: 350 },
  { key: 'km-351-400', label: '351~400', low: 351, high: 400 },
  { key: 'km-401-450', label: '401~450', low: 401, high: 450 },
  { key: 'normal-451', label: '451 Normal base' },
  { key: 'mangalore-451', label: '451 Mangalore base' },
];

function rateTableRows(bases) {
  return RATE_TABLE_ROW_DEFS.map((row, index) => ({ ...row, base: bases[index] }));
}

// Rate tables exist per state and tonnage class. `stateCode` is matched against the suffix of the
// KM table's corporation column (IOC-TN, BPC-TN, ... -> TN), so every corporation in a state
// shares that state's table; the tonnage class comes from the loading weight (<= 18 t -> 18MT,
// else 21MT). Each state's diesel column is shared by its 18MT and 21MT tables.
const RATE_TABLE_STATES = [
  { stateCode: 'TN', dieselState: 'Tamil Nadu' },
  { stateCode: 'KA', dieselState: 'Karnataka' },
  { stateCode: 'AP', dieselState: 'Andhra Pradesh' },
  { stateCode: 'KL', dieselState: 'Kerala' },
  { stateCode: 'PY', dieselState: 'Pondicherry' },
  { stateCode: 'TS', dieselState: 'Telangana' },
];
// Price Escalation is measured against the state's Average Diesel Price of this month (Dec-24, the
// first column of the diesel table, pre-filled with DIESEL_PRICE_ROWS[].baseDieselPrice).
const RATE_TABLE_BASE_DIESEL_MONTH = DIESEL_PRICE_START_MONTH;

// Default Base column per state and tonnage, in RATE_TABLE_ROW_DEFS order
// (0~50 ... 401~450, 451 Normal base, 451 Mangalore base).
const RATE_TABLE_BASES = {
  18: {
    TN: [598.9932, 756.2362, 890.8584, 1049.8361, 1148.6741, 1361.2202, 1433.0686, 1479.1682, 1673.6059, 3.6087, 3.6752],
    KA: [642.6849, 754.3992, 908.4959, 1041.4014, 1238.0294, 1387.1469, 1503.8404, 1614.2731, 1731.4179, 3.6232, 3.6897],
    AP: [590.2854, 682.9283, 910.1780, 1015.7877, 1114.3141, 1229.6147, 1347.0379, 1498.0855, 1705.9119, 3.6196, 3.6196],
    KL: [601.8373, 757.0615, 876.9278, 1047.9342, 1185.0142, 1345.3321, 1544.6470, 1684.1075, 1814.6669, 3.7148, 3.7813],
    PY: [597.2566, 723.5159, 849.7752, 976.0344, 1102.2937, 1128.5530, 1307.7125, 1422.8499, 1630.8807, 3.3887, 3.4552],
    TS: [591.7889, 690.2851, 914.4628, 1000.0300, 1071.3447, 1147.1897, 1229.1878, 1475.0557, 1651.5726, 3.5901, 3.5901],
  },
  21: {
    TN: [565.4635, 709.5435, 834.5169, 981.6259, 1072.5958, 1268.4966, 1334.8247, 1379.8988, 1557.6911, 3.3423, 3.4089],
    KA: [616.4855, 719.1994, 860.3903, 982.3428, 1159.9858, 1295.1566, 1403.8906, 1504.5566, 1614.3810, 3.3547, 3.4212],
    AP: [569.4083, 653.6035, 861.7600, 961.6420, 1052.6625, 1159.1016, 1269.4887, 1407.1977, 1597.8497, 3.3697, 3.3697],
    KL: [582.8050, 723.7365, 839.1508, 990.8377, 1116.6943, 1262.8597, 1445.0928, 1571.4723, 1691.2014, 3.4618, 3.5281],
    PY: [549.9667, 664.9567, 779.9467, 904.8225, 1029.6983, 1134.8025, 1220.1350, 1318.0584, 1529.2016, 3.1221, 3.1886],
    TS: [566.0891, 661.7278, 858.6775, 944.2867, 1009.2057, 1081.5852, 1156.9640, 1379.9428, 1540.0929, 3.2971, 3.2971],
  },
};

// Mileage used to spread a diesel change over the load: 18MT trucks run 3.2 km/litre, 21MT 3.0,
// so Price 1 paise / Price Escalation divide by 3.2 x 18 = 57.6 and 3.0 x 21 = 63 respectively.
const RATE_TABLE_KM_PER_LITRE = { 18: 3.2, 21: 3.0 };

// Contract years 4 and 5: on 1 September the Base of every row is revised by `rate` of its
// non-fuel component and the Price Escalation reference resets to the previous month's diesel.
//   R  = row value of the previous month (August)
//   F  = average KM x diesel[August] / (kmPerLitre x tonnage)   (average KM = band midpoint; 1 for 451 rows)
//   Nr = (R - F) x rate
//   new Base = R + Nr ; afterwards the usual Base + Price Escalation x multiplier calculation continues.
const RATE_TABLE_BASE_REVISIONS = [
  { month: '2028-09', rate: 0.035 },
  { month: '2029-09', rate: 0.035 },
];

const RATE_TABLES = [18, 21].flatMap((tonnage) => RATE_TABLE_STATES.map((state) => ({
  id: `${state.stateCode.toLowerCase()}-${tonnage}mt`,
  title: `Rate/KM/Ton - ${state.stateCode} (${tonnage}MT)`,
  stateCode: state.stateCode,
  startMonth: '2025-09',
  dieselState: state.dieselState,
  baseDieselMonth: RATE_TABLE_BASE_DIESEL_MONTH,
  kmPerLitre: RATE_TABLE_KM_PER_LITRE[tonnage],
  tonnage,
  baseRevisions: RATE_TABLE_BASE_REVISIONS,
  rows: rateTableRows(RATE_TABLE_BASES[tonnage][state.stateCode]),
})));

// Trip income: loads from these locations use the "451 Mangalore base" rate for trips over 450 km.
const MANGALORE_BASE_LOADING_LOCATIONS = ['Total, Mangalore', 'AEGIS, Mangalore', 'MRPL, Mangalore'];
// Weight up to this uses the 18MT rate tables; heavier loads need a 21MT table for the corporation.
const RATE_TABLE_WEIGHT_LIMIT_18MT = 18;
const RATE_TABLE_BAND_MAX_KM = 450;

// Oil / gas company a vehicle is contracted to (chosen when the vehicle is added).
const VEHICLE_CORPORATIONS = ['IOC', 'BPC', 'HPC', 'Total Gas', 'Super Gas'];
// Monthly Income cut-off per vehicle corporation: a month's income includes unloadings up to this
// day of the NEXT month (BPC: 1-5 Oct still count in September). Corporations not listed (IOC,
// HPC, ...) use the calendar month.
const MONTHLY_INCOME_CUTOFF_DAY = { BPC: 5 };
// Vehicle corporations whose month is billed in two halves: 1st-15th and 16th-month end.
const MONTHLY_INCOME_HALF_MONTH_CORPORATIONS = ['IOC', 'HPC'];
const MONTHLY_INCOME_HALF_MONTH_DAY = 15;

// Diesel entry sanity limits (keep in sync with shared/constants.js DIESEL_ENTRY_LIMITS): a fill
// must be more than 5 litres and the price must be more than Rs 50 per litre.
const DIESEL_MIN_LITRES = 5;
const DIESEL_MIN_RATE_PER_LITRE = 50;

module.exports = {
  LOADING_LOCATIONS,
  UNLOADING_LOCATIONS,
  ROUTE_KM_TABLE,
  ROLES,
  TRIP_STATUS,
  DIESEL_PRICE_ROWS,
  DIESEL_PRICE_START_MONTH,
  DIESEL_PRICE_MONTHLY_DEFAULTS,
  DIESEL_PRICE_MONTHLY_MANUAL_DEFAULTS,
  RATE_TABLES,
  RATE_TABLE_BASE_REVISIONS,
  MANGALORE_BASE_LOADING_LOCATIONS,
  RATE_TABLE_WEIGHT_LIMIT_18MT,
  RATE_TABLE_BAND_MAX_KM,
  VEHICLE_CORPORATIONS,
  MONTHLY_INCOME_CUTOFF_DAY,
  MONTHLY_INCOME_HALF_MONTH_CORPORATIONS,
  MONTHLY_INCOME_HALF_MONTH_DAY,
  DIESEL_MIN_LITRES,
  DIESEL_MIN_RATE_PER_LITRE,
};
