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
const DIESEL_PRICE_ROWS = [
  { state: 'Andhra Pradesh', city: 'Amaravati', fuelPriceTodayCity: 'Amaravati', fuelPriceTodayState: 'Andhra Pradesh', v3carsState: 'Andhra Pradesh', v3carsDistrict: 'Amaravati' },
  { state: 'Karnataka', city: 'Bengaluru', fuelPriceTodayCity: 'Bengaluru', fuelPriceTodayState: 'Karnataka', v3carsState: 'Karnataka', v3carsDistrict: 'Bangalore' },
  { state: 'Kerala', city: 'Thiruvananthapuram', fuelPriceTodayCity: 'Thiruvananthapuram', fuelPriceTodayState: 'Kerala', v3carsState: 'Kerala', v3carsDistrict: 'Thiruvananthapuram' },
  { state: 'Pondicherry', city: 'Puducherry', fuelPriceTodayCity: 'Puducherry', fuelPriceTodayState: 'Puducherry (UT)', v3carsState: 'Pondicherry', v3carsDistrict: 'Pondicherry' },
  { state: 'Tamil Nadu', city: 'Chennai', fuelPriceTodayCity: 'Chennai', fuelPriceTodayState: 'Tamil Nadu', v3carsState: 'Tamil Nadu', v3carsDistrict: 'Chennai' },
  { state: 'Telangana', city: 'Hyderabad', fuelPriceTodayCity: 'Hyderabad', fuelPriceTodayState: 'Telangana', v3carsState: 'Telangana', v3carsDistrict: 'Hyderabad' },
];
const DIESEL_PRICE_START_MONTH = '2025-07';

// Super admin "Rate/KM/Ton" tables (one per state), calculated from the Average Diesel Price table.
//   Price 1 paise      = (diesel[m] - diesel[m-1]) / (kmPerLitre * tonnage)
//   Price Escalation   = (diesel[m] - baseDieselPrice) / (kmPerLitre * tonnage)
//   KM band            = base + escalation * multiplier   (multiplier = band midpoint / 2)
//   451 rows           = base + escalation
// Band / 451 rows only recalculate when |Price 1 paise| >= 0.01 (rise or fall), otherwise the
// previous month's value is carried forward. `base` values are defaults; super admin can edit them in the UI.
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
// shares that state's table; the tonnage class comes from the unloading weight (<= 18 t -> 18MT,
// else 21MT). Each state's diesel column and reference price are shared by its 18MT and 21MT tables.
const RATE_TABLE_STATES = [
  { stateCode: 'TN', dieselState: 'Tamil Nadu', baseDieselPrice: 92.39 },
  { stateCode: 'KA', dieselState: 'Karnataka', baseDieselPrice: 88.94 },
  { stateCode: 'AP', dieselState: 'Andhra Pradesh', baseDieselPrice: 97.48 },
  { stateCode: 'KL', dieselState: 'Kerala', baseDieselPrice: 96.37 },
  { stateCode: 'PY', dieselState: 'Pondicherry', baseDieselPrice: 86.5 },
  { stateCode: 'TS', dieselState: 'Telangana', baseDieselPrice: 95.7 },
];

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

const RATE_TABLES = [18, 21].flatMap((tonnage) => RATE_TABLE_STATES.map((state) => ({
  id: `${state.stateCode.toLowerCase()}-${tonnage}mt`,
  title: `Rate/KM/Ton - ${state.stateCode} (${tonnage}MT)`,
  stateCode: state.stateCode,
  startMonth: '2025-09',
  dieselState: state.dieselState,
  baseDieselPrice: state.baseDieselPrice,
  kmPerLitre: 3.2,
  tonnage,
  rows: rateTableRows(RATE_TABLE_BASES[tonnage][state.stateCode]),
})));

// Trip income: loads from these locations use the "451 Mangalore base" rate for trips over 450 km.
const MANGALORE_BASE_LOADING_LOCATIONS = ['Total, Mangalore', 'AEGIS, Mangalore', 'MRPL, Mangalore'];
// Weight up to this uses the 18MT rate tables; heavier loads need a 21MT table for the corporation.
const RATE_TABLE_WEIGHT_LIMIT_18MT = 18;
const RATE_TABLE_BAND_MAX_KM = 450;

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
  RATE_TABLES,
  MANGALORE_BASE_LOADING_LOCATIONS,
  RATE_TABLE_WEIGHT_LIMIT_18MT,
  RATE_TABLE_BAND_MAX_KM,
  DIESEL_MIN_LITRES,
  DIESEL_MIN_RATE_PER_LITRE,
};
