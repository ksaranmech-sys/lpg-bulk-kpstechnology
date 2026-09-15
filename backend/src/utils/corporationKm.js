const fs = require('fs');
const path = require('path');

function loadRouteKmGroups() {
  const filePath = path.join(__dirname, '../config/routeKmGroups.json');
  try {
    const groups = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
      group1: new Set((groups.group1 || []).map((value) => String(value).trim()).filter(Boolean)),
      group2: new Set((groups.group2 || []).map((value) => String(value).trim()).filter(Boolean)),
    };
  } catch (err) {
    return { group1: new Set(), group2: new Set() };
  }
}

function findRouteKm(routeKmTable, loadingLocation, unloadingLocation) {
  const route = routeKmTable.find((row) => (
    String(row.loadingLocation || '').trim() === String(loadingLocation || '').trim() &&
    String(row.unloadingLocation || '').trim() === String(unloadingLocation || '').trim()
  ));
  return Number.isFinite(Number(route?.km)) ? Number(route.km) : null;
}

function getCorporationKmDetails(trip, routeKmTable, routeKmGroups = loadRouteKmGroups()) {
  const loadingLocation = String(trip.loadingLocation || '').trim();
  const unloadingLocation = String(trip.unloadingLocation || '').trim();
  const fillingOrderLocation = String(trip.fillingOrderLocation || '').trim();
  const divertUnloadingLocation = String(trip.divertUnloadingLocation || '').trim();

  if (trip.isDiverted && divertUnloadingLocation) {
    const firstLegKm = findRouteKm(routeKmTable, loadingLocation, unloadingLocation);
    const tableSecondLegKm = findRouteKm(routeKmTable, unloadingLocation, divertUnloadingLocation);
    const manualSecondLegKm = Number(trip.divertKm);
    const secondLegKm = tableSecondLegKm != null
      ? tableSecondLegKm
      : Number.isFinite(manualSecondLegKm) && manualSecondLegKm >= 0 ? manualSecondLegKm : null;
    const thirdLegKm = findRouteKm(routeKmTable, fillingOrderLocation, divertUnloadingLocation);
    if ([firstLegKm, secondLegKm, thirdLegKm].every((km) => km != null)) {
      return {
        value: (firstLegKm * 0.5) + (secondLegKm * 0.5) + (thirdLegKm * 0.5),
        source: tableSecondLegKm != null ? 'km_table_divert_weighted' : 'manual_divert_weighted',
      };
    }
    return { value: null, source: 'manual_required' };
  }

  const directKm = findRouteKm(routeKmTable, loadingLocation, unloadingLocation);
  const loadingGroup = routeKmGroups.group1.has(loadingLocation) ? 'group1'
    : routeKmGroups.group2.has(loadingLocation) ? 'group2' : null;
  const sameGroup = loadingGroup && routeKmGroups[loadingGroup].has(fillingOrderLocation);
  const samePlant = loadingLocation && loadingLocation === fillingOrderLocation;

  if (directKm != null && (!fillingOrderLocation || sameGroup || samePlant)) {
    return { value: directKm, source: 'km_table_direct' };
  }

  if (directKm != null && fillingOrderLocation) {
    const secondLegKm = findRouteKm(routeKmTable, fillingOrderLocation, unloadingLocation);
    if (secondLegKm != null) {
      return { value: (directKm * 0.5) + (secondLegKm * 0.5), source: 'km_table_weighted' };
    }
  }

  return { value: null, source: 'manual_required' };
}

module.exports = { loadRouteKmGroups, findRouteKm, getCorporationKmDetails };
