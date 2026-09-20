/**
 * Trip settlement math.
 *
 * How the business actually works (per spec):
 * - A trip "opens" when a diesel fill happens at the loading location.
 * - It becomes ready to close when diesel is filled again at the loading location for
 *   the NEXT trip. So consecutive trips share a diesel-fill boundary.
 * - Diesel consumed DURING a trip is not simply sum(dieselEntries) for that
 *   trip, because the trip's first fill is really "topping off" left over
 *   from the previous trip and doesn't represent this trip's consumption.
 *   Instead:
 *
 *     dieselForTrip = sum(trip.dieselEntries[1..end].volume)   // skip index 0
 *                    + nextTrip's first filling group
 *
 *   A first filling group normally contains one entry. When its entries carry GPS, all
 *   next-trip fills on that date within 100 m of the first fill are grouped together.
 *
 * - KM for the trip = nextTrip.dieselEntries[0].odometerKm - trip.dieselEntries[0].odometerKm
 *   (distance between this trip's opening fill and the next trip's opening fill).
 *
 * - Mileage = KM / dieselForTrip (km per litre).
 *
 * - Expense total = loadingExpense + turnExpense + parkingExpense + unloadingExpense
 *                   + sum(otherExpenses) + sum(rtoEntries)   <-- RTO IS included; only diesel is excluded.
 *
 * - Balance = totalAdvance - totalExpense
 *   (positive => driver has money left / must return it,
 *    negative => company owes the driver additional money)
 */

function sum(arr, pick) {
  return arr.reduce((acc, item) => acc + (pick ? pick(item) : item), 0);
}

function getDieselGps(entry) {
  const gps = entry?.gps || entry?.photo?.gps;
  const lat = Number(gps?.lat);
  const lng = Number(gps?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function isSameFillDate(firstEntry, entry) {
  const firstDate = new Date(firstEntry?.filledAt);
  const entryDate = new Date(entry?.filledAt);
  return !Number.isNaN(firstDate.getTime()) && !Number.isNaN(entryDate.getTime())
    && firstDate.toISOString().slice(0, 10) === entryDate.toISOString().slice(0, 10);
}

function isSameGpsLocation(firstEntry, entry) {
  const firstGps = getDieselGps(firstEntry);
  const entryGps = getDieselGps(entry);
  if (!firstGps || !entryGps) return false;

  const earthRadiusMetres = 6371000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(entryGps.lat - firstGps.lat);
  const longitudeDelta = toRadians(entryGps.lng - firstGps.lng);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(firstGps.lat)) * Math.cos(toRadians(entryGps.lat)) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceMetres = 2 * earthRadiusMetres * Math.asin(Math.sqrt(haversine));
  return distanceMetres <= 100;
}

function getNextTripFirstFills(nextTrip) {
  const firstFill = nextTrip?.dieselEntries?.[0];
  if (!firstFill) return [];

  // GPS is mandatory for multi-entry grouping. Without it, the first fill is the boundary.
  if (!getDieselGps(firstFill)) return [firstFill];
  return nextTrip.dieselEntries.filter((entry) => isSameFillDate(firstFill, entry) && isSameGpsLocation(firstFill, entry));
}

function calculateClosingOdometerKm(currentTrip, previousTrip) {
  const currentEntries = currentTrip?.dieselEntries || [];
  const previousEntries = previousTrip?.dieselEntries || [];
  const currentClosingOdometer = currentEntries[currentEntries.length - 1]?.odometerKm;
  const previousClosingOdometer = previousEntries[previousEntries.length - 1]?.odometerKm;

  if (!Number.isFinite(currentClosingOdometer) || !Number.isFinite(previousClosingOdometer)) return null;
  return currentClosingOdometer - previousClosingOdometer;
}

/**
 * @param {Trip} trip - the trip being closed/settled (mongoose doc or plain object)
 * @param {Trip|null} nextTrip - the following trip for this vehicle, if it exists yet.
 *   Settlement cannot be finalized until nextTrip records its first diesel fill, OR (if that
 *   hasn't happened yet) its Unload Turn date, OR its own unloading is done - any one confirms
 *   the next trip has genuinely started. Without a diesel fill (on either this trip or the next
 *   one) the diesel/KM/mileage figures stay null until it's filled.
 * @returns {{ ready: boolean, reason?: string, settlement?: object }}
 */
function computeTripSettlement(trip, nextTrip) {
  const dieselEntries = trip.dieselEntries || [];

  const nextTripHasDiesel = Boolean(nextTrip?.dieselEntries?.length);
  const nextTripHasUnloadTurn = Boolean(nextTrip?.unTurnDate);
  const nextTripUnloadingDone = Boolean(nextTrip?.unloadingLocation && nextTrip?.unloadingDate);
  if (!nextTrip || (!nextTripHasDiesel && !nextTripHasUnloadTurn && !nextTripUnloadingDone)) {
    return {
      ready: false,
      reason: 'Trip cannot be finalized until the next trip records its first diesel fill or its Unload Turn date.',
    };
  }

  const firstFill = dieselEntries[0] || null;
  const remainingFills = dieselEntries.slice(1); // everything except the first fill
  const nextTripFirstFills = nextTripHasDiesel ? getNextTripFirstFills(nextTrip) : [];
  const nextTripFirstFill = nextTripFirstFills[0] || null;

  const hasTankFillMarkers = Boolean(firstFill) && Boolean(nextTripFirstFill) && firstFill.loadingPointTankFill === true && nextTripFirstFill.loadingPointTankFill === true;
  const currentFirstOdometerKm = firstFill ? Number(firstFill.odometerKm) : null;
  const nextFirstOdometerKm = nextTripFirstFill ? Number(nextTripFirstFill.odometerKm) : null;
  const hasOdometerData = hasTankFillMarkers && Number.isFinite(currentFirstOdometerKm) && Number.isFinite(nextFirstOdometerKm);
  const totalKm = hasOdometerData ? nextFirstOdometerKm - currentFirstOdometerKm : null;

  if (totalKm != null && totalKm < 0) {
    return {
      ready: false,
      reason: 'Next trip\'s odometer reading is lower than this trip\'s opening reading - check entries.',
    };
  }

  // Diesel-derived figures are only computable once both this trip and the next trip have their
  // fills recorded - if either is missing (closed via Unload Turn/unloading instead), they stay
  // null and get filled in later once the diesel entries exist (refreshRelatedSettlements
  // recomputes this trip's settlement whenever diesel entries change).
  const dieselForTripLitres = (firstFill && nextTripFirstFill)
    ? sum(remainingFills, (e) => e.volumeLitres) + sum(nextTripFirstFills, (e) => e.volumeLitres)
    : null;

  // Cost of diesel is informational (not subtracted from advance per spec),
  // but useful for the printable report.
  const dieselForTripCost = (firstFill && nextTripFirstFill)
    ? sum(remainingFills, (e) => e.amount) + sum(nextTripFirstFills, (e) => e.amount)
    : null;

  const mileageKmPerLitre = totalKm != null && dieselForTripLitres > 0 ? totalKm / dieselForTripLitres : null;

  const rtoTotal = sum(trip.rtoEntries || [], (e) => e.amount);
  const otherTotal = sum(trip.otherExpenses || [], (e) => e.amount);
  const totalExpense =
    (trip.loadingExpense || 0) + (trip.turnExpense || 0) + (trip.parkingExpense || 0)
    + (trip.unloadingExpense || 0) + rtoTotal + otherTotal;

  const totalAdvance = sum(trip.driverAdvances || [], (e) => e.amount);

  const balance = totalAdvance - totalExpense;

  return {
    ready: true,
    settlement: {
      totalDieselLitres: dieselForTripLitres != null ? round2(dieselForTripLitres) : null,
      totalDieselCost: dieselForTripCost != null ? round2(dieselForTripCost) : null,
      totalKm: totalKm != null ? round2(totalKm) : null,
      mileageKmPerLitre: mileageKmPerLitre != null ? round2(mileageKmPerLitre) : null,
      totalExpense: round2(totalExpense),
      totalAdvance: round2(totalAdvance),
      balance: round2(balance),
      calculatedAt: new Date(),
    },
  };
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

module.exports = { computeTripSettlement, calculateClosingOdometerKm };
