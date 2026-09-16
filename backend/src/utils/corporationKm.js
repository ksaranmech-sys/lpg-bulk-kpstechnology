function findRouteKm(routeKmTable, loadingLocation, unloadingLocation) {
  const route = routeKmTable.find((row) => (
    String(row.loadingLocation || '').trim() === String(loadingLocation || '').trim() &&
    String(row.unloadingLocation || '').trim() === String(unloadingLocation || '').trim()
  ));
  return Number.isFinite(Number(route?.km)) ? Number(route.km) : null;
}

function getRequiredRouteLegs(trip) {
  const loadingLocation = String(trip.loadingLocation || '').trim();
  const unloadingLocation = String(trip.unloadingLocation || '').trim();
  const fillingOrderLocation = String(trip.fillingOrderLocation || '').trim();
  const divertUnloadingLocation = String(trip.divertUnloadingLocation || '').trim();

  if (!loadingLocation || !unloadingLocation || !fillingOrderLocation) return null;
  if (trip.isDiverted) {
    if (!divertUnloadingLocation) return null;
    return [
      { from: loadingLocation, to: unloadingLocation },
      { from: unloadingLocation, to: divertUnloadingLocation },
      { from: fillingOrderLocation, to: divertUnloadingLocation },
    ];
  }
  return [
    { from: loadingLocation, to: unloadingLocation },
    { from: fillingOrderLocation, to: unloadingLocation },
  ];
}

function getMissingRouteLegs(trip, routeKmTable) {
  const requiredLegs = getRequiredRouteLegs(trip);
  if (!requiredLegs) return null;
  return requiredLegs.filter((leg) => findRouteKm(routeKmTable, leg.from, leg.to) == null);
}

function getCorporationKmDetails(trip, routeKmTable) {
  const manualKmValue = trip.manualKm;
  const manualKm = Number(manualKmValue);
  const hasManualKm = manualKmValue !== null
    && manualKmValue !== undefined
    && manualKmValue !== ''
    && Number.isFinite(manualKm)
    && manualKm >= 0;
  const divertKmValue = trip.divertKm;
  const divertKm = Number(divertKmValue);
  const hasDivertKm = divertKmValue !== null
    && divertKmValue !== undefined
    && divertKmValue !== ''
    && Number.isFinite(divertKm)
    && divertKm >= 0;
  const requiredLegs = getRequiredRouteLegs(trip);
  if (!requiredLegs) {
    if (!hasManualKm || !String(trip.loadingLocation || '').trim() || !String(trip.unloadingLocation || '').trim()) {
      return { value: null, source: 'route_incomplete', missingLegs: [] };
    }
    // Preserve legacy reporting for already-saved trips that predate the
    // filling-order field, without making Manual KM compulsory too early.
    const loadingLocation = String(trip.loadingLocation || '').trim();
    const unloadingLocation = String(trip.unloadingLocation || '').trim();
    const fillingOrderLocation = String(trip.fillingOrderLocation || '').trim();
    const divertUnloadingLocation = String(trip.divertUnloadingLocation || '').trim();
    const legacyLegs = trip.isDiverted && divertUnloadingLocation
      ? [
          findRouteKm(routeKmTable, loadingLocation, unloadingLocation),
          findRouteKm(routeKmTable, unloadingLocation, divertUnloadingLocation),
          findRouteKm(routeKmTable, fillingOrderLocation, divertUnloadingLocation),
        ]
      : [
          findRouteKm(routeKmTable, loadingLocation, unloadingLocation),
          findRouteKm(routeKmTable, fillingOrderLocation, unloadingLocation),
        ];
    const resolvedLegacyLegs = legacyLegs.map((km, index) => {
      if (km != null) return km;
      if (trip.isDiverted && index === 1 && hasDivertKm) return divertKm;
      return manualKm;
    });
    return {
      value: resolvedLegacyLegs.reduce((total, km) => total + (km * 0.5), 0),
      source: trip.isDiverted && divertUnloadingLocation ? 'manual_divert_weighted' : 'manual_weighted',
      missingLegs: [],
    };
  }

  const tableLegs = requiredLegs.map((leg) => findRouteKm(routeKmTable, leg.from, leg.to));
  if (trip.isDiverted) {
    const legs = tableLegs.map((km, index) => {
      if (km != null) return km;
      if (index === 1) return hasDivertKm ? divertKm : null;
      return hasManualKm ? manualKm : null;
    });
    const missingLegs = requiredLegs.filter((leg, index) => legs[index] == null);
    const [firstLegKm, secondLegKm, thirdLegKm] = legs;
    if ([firstLegKm, secondLegKm, thirdLegKm].every((km) => km != null)) {
      return {
        value: (firstLegKm * 0.5) + (secondLegKm * 0.5) + (thirdLegKm * 0.5),
        source: tableLegs.some((km) => km == null) ? 'manual_divert_weighted' : 'km_table_divert_weighted',
        missingLegs,
      };
    }
    return { value: null, source: 'manual_required', missingLegs };
  } else {
    const [firstLegKm, secondLegKm] = tableLegs.map((km) => km == null ? (hasManualKm ? manualKm : null) : km);
    const missingLegs = requiredLegs.filter((leg, index) => (
      tableLegs[index] == null && !hasManualKm
    ));
    if (firstLegKm != null && secondLegKm != null) {
      return {
        value: (firstLegKm * 0.5) + (secondLegKm * 0.5),
        source: tableLegs.some((km) => km == null) ? 'manual_weighted' : 'km_table_weighted',
        missingLegs,
      };
    }
    return { value: null, source: 'manual_required', missingLegs };
  }
}

module.exports = { findRouteKm, getRequiredRouteLegs, getMissingRouteLegs, getCorporationKmDetails };
