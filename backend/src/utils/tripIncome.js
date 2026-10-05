// Trip Income shown to admins on the single-trip page.
//
// Trip Income KM (per leg, round trip): the KM table value for the leg, or the manual one-way KM
// for that leg x 2 when the route is not in the table. A diverted trip has two legs:
//   load   = loadingLocation -> unloadingLocation          (manualKm)
//   divert = unloadingLocation -> divertUnloadingLocation  (manualKmDivert)
//
// Trip Income (per leg) uses the Rate/KM/Ton table for the route's corporation state (the suffix
// of the KM table's corporation column: IOC-TN / BPC-TN -> TN table, IOC-KA / BPC-KA -> KA table)
// and tonnage class (<= 18 t -> 18MT, else 21MT), in the trip's loading month. When the route
// itself is not in the KM table (manual KM), the corporation is the one with the most KM-table
// routes from the loading location:
//   km <= 450                 : weight x KM-band rate
//   km >  450, Mangalore load : weight x km x "451 Mangalore base"
//   km >  450, other load     : weight x km x "451 Normal base"
// The divert leg starts at the first unloading point, so it is never a Mangalore-base load.
const { findRouteKm } = require('./corporationKm');
const rateTables = require('./rateTables');
const dieselPrices = require('./dieselPrices');
const {
  RATE_TABLES,
  MANGALORE_BASE_LOADING_LOCATIONS,
  RATE_TABLE_WEIGHT_LIMIT_18MT,
  RATE_TABLE_BAND_MAX_KM,
} = require('../config/constants');

function clean(value) {
  return String(value || '').trim();
}

function normalizeLocation(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

const MANGALORE_KEYS = new Set(MANGALORE_BASE_LOADING_LOCATIONS.map(normalizeLocation));

// Exact configured names first; otherwise any spelling that mentions Mangalore or MRPL (older KM
// table rows used "AEGIS-Mangalore" / "MRPL").
function isMangaloreBaseLoading(location) {
  const key = normalizeLocation(location);
  if (!key) return false;
  return MANGALORE_KEYS.has(key) || key.includes('mangalore') || key.startsWith('mrpl');
}

function findRouteRow(routeKmTable, loadingLocation, unloadingLocation) {
  return (routeKmTable || []).find((row) => (
    clean(row.loadingLocation) === clean(loadingLocation) && clean(row.unloadingLocation) === clean(unloadingLocation)
  )) || null;
}

// The KM table's corporation for this trip: from the exact route, else from rows sharing the
// loading location (the single corporation, or the one with the most routes from there), else
// from rows sharing the unloading location when they agree on a single corporation.
function resolveCorporation(routeKmTable, loadingLocation, unloadingLocation) {
  const rows = routeKmTable || [];
  const exact = findRouteRow(rows, loadingLocation, unloadingLocation);
  if (exact?.corporation) return { corporation: clean(exact.corporation), source: 'route', candidates: [clean(exact.corporation)] };
  const distinct = (matches) => Array.from(new Set(matches.map((row) => clean(row.corporation)).filter(Boolean)));
  const loadingRows = rows.filter((row) => clean(row.loadingLocation) === clean(loadingLocation));
  const byLoading = distinct(loadingRows);
  if (byLoading.length === 1) return { corporation: byLoading[0], source: 'loading-location', candidates: byLoading };
  if (byLoading.length > 1) {
    const counts = byLoading.map((corporation) => ({
      corporation,
      count: loadingRows.filter((row) => clean(row.corporation) === corporation).length,
    }));
    const max = Math.max(...counts.map((entry) => entry.count));
    const leaders = counts.filter((entry) => entry.count === max);
    if (leaders.length === 1) return { corporation: leaders[0].corporation, source: 'loading-location-majority', candidates: byLoading };
  }
  const byUnloading = distinct(rows.filter((row) => clean(row.unloadingLocation) === clean(unloadingLocation)));
  if (byUnloading.length === 1) return { corporation: byUnloading[0], source: 'unloading-location', candidates: byUnloading };
  const candidates = byLoading.length ? byLoading : byUnloading;
  return { corporation: null, source: candidates.length > 1 ? 'ambiguous' : null, candidates };
}

function tonnageClassFor(weightTons) {
  return weightTons <= RATE_TABLE_WEIGHT_LIMIT_18MT ? 18 : 21;
}

// State code of a KM-table corporation: the part after the last dash ('IOC-TN' -> 'TN',
// 'BPC-KA' -> 'KA'); a bare code ('TN') is returned as-is.
function corporationStateCode(corporation) {
  const parts = clean(corporation).toUpperCase().split('-').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function selectRateTableConfig(corporation, tonnageClass) {
  const stateCode = corporationStateCode(corporation);
  if (!stateCode) return null;
  return RATE_TABLES.find((table) => (
    clean(table.stateCode).toUpperCase() === stateCode && table.tonnage === tonnageClass
  )) || null;
}

// Round-trip KM for one leg: KM table value, else manual one-way x 2.
function legKm(routeKmTable, from, to, manualOneWayKm) {
  const tableKm = findRouteKm(routeKmTable || [], from, to);
  if (tableKm != null) return { km: tableKm, kmSource: 'km_table' };
  const manual = manualOneWayKm == null || manualOneWayKm === '' ? NaN : Number(manualOneWayKm);
  if (Number.isFinite(manual) && manual >= 0) return { km: manual * 2, kmSource: 'manual' };
  return { km: null, kmSource: null };
}

function bandRowFor(rateTable, km) {
  return (rateTable?.rows || []).find((row) => row.kind === 'band' && Number.isFinite(row.low) && km <= row.high) || null;
}

// Loading month in India, e.g. '2026-08'.
function tripMonth(trip) {
  const date = trip.loadingDate || trip.unloadingDate || trip.createdAt;
  return date ? dieselPrices.istDayKey(date)?.slice(0, 7) || null : null;
}

function computeLegIncome({ leg, rateTable, month, weightTons, mangaloreBase }) {
  if (leg.km == null || !rateTable || weightTons == null) return { ...leg, type: null, rateLabel: null, rate: null, rateMonth: null, income: null };
  if (leg.km <= RATE_TABLE_BAND_MAX_KM) {
    const band = bandRowFor(rateTable, leg.km);
    const { value, month: rateMonth } = rateTables.rateValueForMonth(rateTable, band?.key, month);
    const income = value == null ? null : round2(weightTons * value);
    return { ...leg, type: 'band', rateLabel: band ? `${band.label} KM` : null, rate: value, rateMonth, income };
  }
  const rowKey = mangaloreBase ? 'mangalore-451' : 'normal-451';
  const { value, month: rateMonth } = rateTables.rateValueForMonth(rateTable, rowKey, month);
  const income = value == null ? null : round2(weightTons * leg.km * value);
  return {
    ...leg,
    type: mangaloreBase ? 'mangalore-451' : 'normal-451',
    rateLabel: mangaloreBase ? '451 Mangalore base' : '451 Normal base',
    rate: value,
    rateMonth,
    income,
  };
}

// trip: plain trip object; routeKmTable: KM table rows; getRateTable: (tableId) => computed table.
function computeTripIncome(trip, routeKmTable, { getRateTable = (id) => rateTables.getRateTable(id), now } = {}) {
  const loadingLocation = clean(trip?.loadingLocation);
  const unloadingLocation = clean(trip?.unloadingLocation);
  const divertLocation = clean(trip?.divertUnloadingLocation);
  const isDiverted = Boolean(trip?.isDiverted && divertLocation);
  const errors = [];

  const legs = [];
  if (loadingLocation && unloadingLocation) {
    legs.push({ leg: 'load', from: loadingLocation, to: unloadingLocation, manualOneWayKm: trip.manualKm ?? null, ...legKm(routeKmTable, loadingLocation, unloadingLocation, trip.manualKm) });
    if (isDiverted) {
      legs.push({ leg: 'divert', from: unloadingLocation, to: divertLocation, manualOneWayKm: trip.manualKmDivert ?? null, ...legKm(routeKmTable, unloadingLocation, divertLocation, trip.manualKmDivert) });
    }
  } else {
    errors.push('Loading and unloading locations are required to calculate Trip Income KM.');
  }
  legs.forEach((leg) => {
    if (leg.km == null) {
      errors.push(`${leg.from} \u2192 ${leg.to} is not in the KM table and no Manual KM ${leg.leg === 'divert' ? 'Divert' : 'Load'} is entered.`);
    }
  });
  const totalKm = legs.length && legs.every((leg) => leg.km != null) ? legs.reduce((sum, leg) => sum + leg.km, 0) : null;

  const weightRaw = trip?.unloadingWeightTons;
  const weightTons = weightRaw == null || weightRaw === '' || !Number.isFinite(Number(weightRaw)) ? null : Number(weightRaw);
  if (weightTons == null) errors.push('Unloading weight (tons) is required to calculate Trip Income.');
  const tonnageClass = weightTons == null ? null : tonnageClassFor(weightTons);

  const { corporation, source: corporationSource, candidates } = resolveCorporation(routeKmTable, loadingLocation, unloadingLocation);
  if (!corporation && loadingLocation && unloadingLocation) {
    errors.push(corporationSource === 'ambiguous'
      ? `${loadingLocation} \u2192 ${unloadingLocation} is not in the KM table and ${loadingLocation} serves ${candidates.join(' and ')} equally - add the route to the KM table to calculate Trip Income.`
      : 'Corporation could not be determined from the KM table for this route.');
  }
  if (corporation && corporationSource === 'loading-location-majority') {
    errors.push(`${loadingLocation} \u2192 ${unloadingLocation} is not in the KM table; Trip Income uses the ${corporation} rate (most routes from ${loadingLocation} are ${corporation}; also serves ${candidates.filter((c) => c !== corporation).join(', ')}).`);
  }

  const config = tonnageClass == null ? null : selectRateTableConfig(corporation, tonnageClass);
  if (corporation && tonnageClass != null && !config) {
    errors.push(`No ${tonnageClass}MT Rate/KM/Ton table is configured for ${corporation} (state ${corporationStateCode(corporation) || 'unknown'}).`);
  }
  const rateTable = config ? getRateTable(config.id, { now }) : null;
  const month = tripMonth(trip || {});
  const mangaloreBase = isMangaloreBaseLoading(loadingLocation);

  const pricedLegs = legs.map((leg) => computeLegIncome({
    leg,
    rateTable,
    month,
    weightTons,
    mangaloreBase: leg.leg === 'load' && mangaloreBase,
  }));
  const totalIncome = pricedLegs.length && pricedLegs.every((leg) => leg.income != null)
    ? round2(pricedLegs.reduce((sum, leg) => sum + leg.income, 0))
    : null;

  return {
    weightTons,
    tonnageClass,
    corporation,
    corporationSource,
    mangaloreBase,
    rateTable: config ? { id: config.id, title: config.title } : null,
    month,
    legs: pricedLegs,
    totalKm,
    totalIncome,
    errors,
  };
}

module.exports = {
  isMangaloreBaseLoading,
  resolveCorporation,
  tonnageClassFor,
  corporationStateCode,
  selectRateTableConfig,
  legKm,
  tripMonth,
  computeTripIncome,
};
