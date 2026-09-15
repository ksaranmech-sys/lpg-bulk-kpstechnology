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
  const manualKm = Number(trip.manualKm);
  const hasManualKm = Number.isFinite(manualKm) && manualKm >= 0;

  if (trip.isDiverted && divertUnloadingLocation) {
    const tableLegs = [
      findRouteKm(routeKmTable, loadingLocation, unloadingLocation),
      findRouteKm(routeKmTable, unloadingLocation, divertUnloadingLocation),
      findRouteKm(routeKmTable, fillingOrderLocation, divertUnloadingLocation),
    ];
    const legs = tableLegs.map((km) => km == null ? (hasManualKm ? manualKm : null) : km);
    const [firstLegKm, secondLegKm, thirdLegKm] = legs;
    if ([firstLegKm, secondLegKm, thirdLegKm].every((km) => km != null)) {
      return {
        value: (firstLegKm * 0.5) + (secondLegKm * 0.5) + (thirdLegKm * 0.5),
        source: tableLegs.some((km) => km == null) ? 'manual_divert_weighted' : 'km_table_divert_weighted',
      };
    }
  } else {
    const tableLegs = [
      findRouteKm(routeKmTable, loadingLocation, unloadingLocation),
      findRouteKm(routeKmTable, fillingOrderLocation, unloadingLocation),
    ];
    const [firstLegKm, secondLegKm] = tableLegs.map((km) => km == null ? (hasManualKm ? manualKm : null) : km);
    if (firstLegKm != null && secondLegKm != null) {
      return {
        value: (firstLegKm * 0.5) + (secondLegKm * 0.5),
        source: tableLegs.some((km) => km == null) ? 'manual_weighted' : 'km_table_weighted',
      };
    }
  }

  return { value: null, source: 'manual_required' };
}

module.exports = { findRouteKm, getCorporationKmDetails };
