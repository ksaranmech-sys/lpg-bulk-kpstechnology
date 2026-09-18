function findRouteKm(routeKmTable, loadingLocation, unloadingLocation) {
  const route = routeKmTable.find((row) => (
    String(row.loadingLocation || '').trim() === String(loadingLocation || '').trim() &&
    String(row.unloadingLocation || '').trim() === String(unloadingLocation || '').trim()
  ));
  return Number.isFinite(Number(route?.km)) ? Number(route.km) : null;
}

function getCorporationKmDetails(trip, routeKmTable) {
  const loadingLocation = String(trip.loadingLocation || '').trim();
  const unloadingLocation = String(trip.unloadingLocation || '').trim();
  const fillingOrderLocation = String(trip.fillingOrderLocation || '').trim();
  const divertUnloadingLocation = String(trip.divertUnloadingLocation || '').trim();
  // Number(null) is 0, not NaN, so check for null/undefined explicitly before coercing.
  // manualKm is the manual fallback for the loading->unloading leg; manualKmDivert is the
  // fallback for the unloading->divertUnloading leg (divert case only); manualKmReturn is the
  // fallback for the fillingOrder->(divertUnloading or unloading) return leg. Each is used only
  // for its own leg when that leg has no exact match in the route KM table.
  const manualKm = trip.manualKm == null ? NaN : Number(trip.manualKm);
  const hasManualKm = Number.isFinite(manualKm) && manualKm >= 0;
  const manualKmDivert = trip.manualKmDivert == null ? NaN : Number(trip.manualKmDivert);
  const hasManualKmDivert = Number.isFinite(manualKmDivert) && manualKmDivert >= 0;
  const manualKmReturn = trip.manualKmReturn == null ? NaN : Number(trip.manualKmReturn);
  const hasManualKmReturn = Number.isFinite(manualKmReturn) && manualKmReturn >= 0;

  if (trip.isDiverted && divertUnloadingLocation) {
    const leg0 = findRouteKm(routeKmTable, loadingLocation, unloadingLocation);
    const leg1 = findRouteKm(routeKmTable, unloadingLocation, divertUnloadingLocation);
    const leg2 = findRouteKm(routeKmTable, fillingOrderLocation, divertUnloadingLocation);
    const resolvedLeg0 = leg0 != null ? leg0 : (hasManualKm ? manualKm : null);
    const resolvedLeg1 = leg1 != null ? leg1 : (hasManualKmDivert ? manualKmDivert : null);
    // If the return (Turn Location) leg isn't in the table, reuse the Load or Divert leg's
    // resolved value when the Turn Location matches the Loading or Unloading location -
    // only falling back to a separate Manual KM Return when neither leg applies.
    let resolvedLeg2;
    if (leg2 != null) {
      resolvedLeg2 = leg2;
    } else if (fillingOrderLocation && fillingOrderLocation === loadingLocation) {
      resolvedLeg2 = resolvedLeg0;
    } else if (fillingOrderLocation && fillingOrderLocation === unloadingLocation) {
      resolvedLeg2 = resolvedLeg1;
    } else {
      resolvedLeg2 = hasManualKmReturn ? manualKmReturn : null;
    }
    if (resolvedLeg0 != null && resolvedLeg1 != null && resolvedLeg2 != null) {
      const allFromTable = leg0 != null && leg1 != null && leg2 != null;
      return {
        value: (resolvedLeg0 * 0.5) + (resolvedLeg1 * 0.5) + (resolvedLeg2 * 0.5),
        source: allFromTable ? 'km_table_divert_weighted' : 'manual',
      };
    }
    return { value: null, source: 'manual_required' };
  }

  const leg0 = findRouteKm(routeKmTable, loadingLocation, unloadingLocation);
  const leg1 = findRouteKm(routeKmTable, fillingOrderLocation, unloadingLocation);
  const resolvedLeg0 = leg0 != null ? leg0 : (hasManualKm ? manualKm : null);
  // Same reuse rule as above: Turn Location matching the Loading location reuses the Load
  // leg's resolved value instead of requiring a separate Manual KM Return.
  const resolvedLeg1 = leg1 != null
    ? leg1
    : (fillingOrderLocation && fillingOrderLocation === loadingLocation)
      ? resolvedLeg0
      : (hasManualKmReturn ? manualKmReturn : null);
  if (resolvedLeg0 != null && resolvedLeg1 != null) {
    const allFromTable = leg0 != null && leg1 != null;
    return {
      value: (resolvedLeg0 * 0.5) + (resolvedLeg1 * 0.5),
      source: allFromTable ? 'km_table_weighted' : 'manual',
    };
  }
  return { value: null, source: 'manual_required' };
}

module.exports = { findRouteKm, getCorporationKmDetails };
