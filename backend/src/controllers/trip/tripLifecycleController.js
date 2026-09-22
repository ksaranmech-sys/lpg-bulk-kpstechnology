// Trip lifecycle handlers: create, read, loading/unloading/turn details, close, delete.
const Trip = require('../../models/Trip');
const Vehicle = require('../../models/Vehicle');
const User = require('../../models/User');
const { saveUploadedFile } = require('../../middleware/upload');
const { computeTripSettlement, calculateClosingOdometerKm } = require('../../utils/tripCalculations');
const { TRIP_STATUS, ROLES } = require('../../config/constants');
const { removeExpiredClosedTrips } = require('../../utils/tripRetention');
const metaRoutes = require('../../routes/metaRoutes');
const { getCorporationKmDetails, findRouteKm } = require('../../utils/corporationKm');
const {
  getTripCloseDate,
  getEntryFloorDate,
  getMissingTripRouteFields,
  tryCloseVehiclePreviousTrip,
  refreshTripSettlement,
  getOpenTripOr404,
} = require('./tripHelpers');

// POST /api/v1/vehicles/:vehicleId/trips
// body: { loadingLocation, loadingExpense, driverAdvances: [{amount,date}] }
async function createTrip(req, res) {
  const { vehicleId } = req.params;
  const { loadingLocation, loadingExpense, driverAdvances } = req.body;

  await removeExpiredClosedTrips();

  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

  const driver = await User.findOne({
    role: ROLES.VEHICLE_USER,
    vehicle: vehicle._id,
    isActive: true,
  });

  if (!driver) {
    return res.status(400).json({ error: 'Driver must be assigned before starting a trip' });
  }

  const existingUnfinishedTrip = await Trip.findOne({
    vehicle: vehicle._id,
    status: { $in: [TRIP_STATUS.OPEN, TRIP_STATUS.PENDING_CLOSE] },
  }).sort({ createdAt: -1 });

  if (existingUnfinishedTrip?.status === TRIP_STATUS.OPEN) {
    return res.status(400).json({
      error: 'This vehicle already has an open trip. Close the current trip before creating a new one.',
    });
  }

  // A trip awaiting customer close (pending_close) no longer blocks the
  // driver: the vehicle is physically free, so the next trip can start.
  // Try to settle it now (route details + next trip's first fill may exist);
  // the driver sees the outcome in the response message.
  let previousTripNotice = null;
  if (existingUnfinishedTrip?.status === TRIP_STATUS.PENDING_CLOSE) {
    const canAutoClose = getMissingTripRouteFields(existingUnfinishedTrip).length === 0;
    if (canAutoClose) {
      const result = computeTripSettlement(existingUnfinishedTrip, null);
      if (result.ready) {
        existingUnfinishedTrip.settlement = result.settlement;
        existingUnfinishedTrip.status = TRIP_STATUS.CLOSED;
        existingUnfinishedTrip.closedAt = getTripCloseDate(existingUnfinishedTrip);
        await existingUnfinishedTrip.save();
        previousTripNotice = 'Previous trip settled and closed.';
      }
    }
    if (!previousTripNotice) {
      previousTripNotice = 'Previous trip is still awaiting customer close.';
    }
  }

  let trip;
  try {
    trip = await Trip.create({
      customer: vehicle.customer,
      vehicle: vehicle._id,
      ...(loadingLocation ? { loadingLocation: loadingLocation.trim() } : {}),
      loadingExpense: loadingExpense || 0,
      driverAdvances: driverAdvances || [],
      createdBy: req.user.id,
    });
  } catch (err) {
    // Unique partial index on {vehicle, status: open|pending_close} - catches the rare race
    // where two requests both passed the "no open trip" check before either write committed.
    if (err.code === 11000) {
      return res.status(400).json({
        error: 'This vehicle already has an open trip. Close the current trip before creating a new one.',
      });
    }
    throw err;
  }

  res.status(201).json({ trip, ...(previousTripNotice ? { message: previousTripNotice } : {}) });
}

// PATCH /api/v1/trips/:tripId/loading   body: { loadingLocation, loadingDate, loadingExpense, parkingExpense, turnExpense }
async function setLoadingDetails(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { loadingLocation, loadingDate, loadingExpense, parkingExpense, turnExpense } = req.body;
  if (loadingLocation != null) {
    const value = String(loadingLocation).trim();
    if (!value) return res.status(400).json({ error: 'loadingLocation cannot be empty' });
    trip.loadingLocation = value;
  }
  if (loadingDate != null) {
    const date = new Date(loadingDate);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'loadingDate must be a valid date' });
    const floor = await getEntryFloorDate(trip);
    if (floor && date < floor) {
      return res.status(400).json({ error: "Loading date cannot be before the driver's joining date or the previous trip's close date." });
    }
    trip.loadingDate = date;
  }
  if (loadingExpense != null) {
    const expense = Number(loadingExpense);
    if (!Number.isFinite(expense) || expense < 0) {
      return res.status(400).json({ error: 'loadingExpense must be a non-negative number' });
    }
    trip.loadingExpense = expense;
  }
  if (parkingExpense != null) {
    const expense = Number(parkingExpense);
    if (!Number.isFinite(expense) || expense < 0) {
      return res.status(400).json({ error: 'parkingExpense must be a non-negative number' });
    }
    trip.parkingExpense = expense;
  }
  if (req.file) {
    const { lat, lng } = req.body;
    const url = await saveUploadedFile(req.file);
    trip.parkingPhoto = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }
  if (turnExpense != null) {
    const expense = Number(turnExpense);
    if (!Number.isFinite(expense) || expense < 0) {
      return res.status(400).json({ error: 'turnExpense must be a non-negative number' });
    }
    trip.turnExpense = expense;
  }
  await trip.save();
  res.json({ trip });
}

// DELETE /api/v1/trips/:tripId/loading-expense
async function deleteLoadingExpense(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  trip.loadingExpense = 0;
  await trip.save();
  res.json({ trip });
}

// GET /api/v1/vehicles/:vehicleId/trips?status=open|closed
async function listTripsForVehicle(req, res) {
  const { vehicleId } = req.params;
  const filter = { vehicle: vehicleId };
  if (req.query.status) filter.status = req.query.status;

  const trips = await Trip.find(filter).sort('-createdAt');
  res.json({ trips });
}

// GET /api/v1/trips/:tripId
async function getTrip(req, res) {
  const trip = await Trip.findById(req.params.tripId)
    .populate('vehicle', 'vehicleNumber')
    .populate('customer', 'companyName email');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const previousTrip = await Trip.findOne({
    vehicle: trip.vehicle._id,
    createdAt: { $lt: trip.createdAt },
  }).sort('-createdAt');
  const driver = await User.findOne({ role: ROLES.VEHICLE_USER, vehicle: trip.vehicle._id }).select('name temporaryDriver joiningDate');
  if (trip.status === TRIP_STATUS.CLOSED) await refreshTripSettlement(trip);
  const result = trip.toObject();
  result.odometerKm = trip.status === TRIP_STATUS.CLOSED && trip.settlement?.totalKm != null
    ? trip.settlement.totalKm
    : calculateClosingOdometerKm(trip, previousTrip);
  result.corporationKmSource = getCorporationKmDetails(
    result,
    metaRoutes.loadRouteKmTable()
  ).source;
  result.corpKm = findRouteKm(metaRoutes.loadRouteKmTable(), result.loadingLocation, result.unloadingLocation);
  result.corporationKm = getCorporationKmDetails(
    result,
    metaRoutes.loadRouteKmTable()
  ).value;
  result.driverName = driver?.getDisplayName() || null;
  // Used by the frontend to grey out dates before whichever is later: the driver's joining date,
  // or the previous trip's Load Turn date (that trip counts as closed once the driver pressed
  // Trip Close, even if its settlement is still finalizing in the background).
  const driverJoiningDate = driver?.joiningDate ? new Date(driver.joiningDate) : null;
  const previousTripCloseDate = (previousTrip?.status !== TRIP_STATUS.OPEN && previousTrip?.turnDate)
    ? new Date(previousTrip.turnDate)
    : null;
  result.entryMinDate = driverJoiningDate && previousTripCloseDate
    ? (driverJoiningDate > previousTripCloseDate ? driverJoiningDate : previousTripCloseDate)
    : (driverJoiningDate || previousTripCloseDate || null);
  res.json({ trip: result });
}

// PATCH /api/v1/trips/:tripId/unloading
async function setUnloading(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const {
    unloadingLocation,
    unloadingDate,
    unloadingExpense,
    manualKm,
    manualKmDivert,
    isDiverted,
    divertUnloadingLocation,
    divertDate,
  } = req.body;
  if (unloadingLocation) trip.unloadingLocation = unloadingLocation;
  if (!unloadingDate) return res.status(400).json({ error: 'unloadingDate is required' });
  const date = new Date(unloadingDate);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'unloadingDate must be a valid date' });
  if (trip.unTurnDate && date < trip.unTurnDate) {
    return res.status(400).json({ error: 'Unloading date must be the same as or after the Unload Turn date.' });
  }
  trip.unloadingDate = date;
  if (unloadingExpense != null) trip.unloadingExpense = Number(unloadingExpense);
  if (manualKm != null && manualKm !== '') {
    const km = Number(manualKm);
    if (!Number.isFinite(km) || km < 0) {
      return res.status(400).json({ error: 'manualKm must be a non-negative number' });
    }
    trip.manualKm = km;
  }
  if (manualKmDivert != null && manualKmDivert !== '') {
    const km = Number(manualKmDivert);
    if (!Number.isFinite(km) || km < 0) {
      return res.status(400).json({ error: 'manualKmDivert must be a non-negative number' });
    }
    trip.manualKmDivert = km;
  }
  // Once loading + unloading location are both known, the route must be resolvable from the KM
  // table or the driver/admin must supply Manual KM Load - otherwise Driver KM would silently be wrong.
  if (trip.unloadingLocation && trip.manualKm == null) {
    const routeKm = findRouteKm(metaRoutes.loadRouteKmTable(), trip.loadingLocation, trip.unloadingLocation);
    if (routeKm == null) {
      return res.status(400).json({
        error: 'Please enter Manual KM Load between the loading and unloading location (Round trip).',
      });
    }
  }
  if (isDiverted != null) {
    trip.isDiverted = Boolean(isDiverted);
    if (trip.isDiverted) {
      const location = String(divertUnloadingLocation || '').trim();
      if (!location) return res.status(400).json({ error: 'divertUnloadingLocation is required when diverted' });
      const date = new Date(divertDate);
      if (!divertDate || Number.isNaN(date.getTime())) {
        return res.status(400).json({ error: 'divertDate must be a valid date when diverted' });
      }
      if (trip.unloadingDate && date < trip.unloadingDate) {
        return res.status(400).json({ error: 'Divert Unloading date must be the same as or after the Unloading date.' });
      }
      trip.divertUnloadingLocation = location;
      trip.divertDate = date;
      // Same rule for the divert leg: unloading -> new unloading must resolve from the KM
      // table, or its own Manual KM Divert fallback must be supplied.
      if (trip.manualKmDivert == null) {
        const divertRouteKm = findRouteKm(metaRoutes.loadRouteKmTable(), trip.unloadingLocation, trip.divertUnloadingLocation);
        if (divertRouteKm == null) {
          return res.status(400).json({
            error: 'Please enter Manual KM Divert between the unloading location and divert location (Round trip).',
          });
        }
      }
    } else {
      trip.divertUnloadingLocation = null;
      trip.divertDate = null;
      // Manual KM Divert only applies to the divert leg - clear it once diverting is undone.
      trip.manualKmDivert = null;
    }
  }
  await trip.save();
  // Unloading being done is another signal (besides the first diesel fill or Unload Turn) that
  // this trip has genuinely started, so it can also unblock closing the vehicle's previous trip.
  await tryCloseVehiclePreviousTrip(trip);
  res.json({ trip });
}

// PATCH /api/v1/trips/:tripId/turn   body: { turnNumber, turnDate, fillingOrderLocation, manualKmReturn }
async function setTurnDetails(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { turnNumber, turnDate, fillingOrderLocation, manualKmReturn } = req.body;
  if (turnNumber == null || turnNumber === '') {
    return res.status(400).json({ error: 'turnNumber is required' });
  }
  const number = Number(turnNumber);
  if (!Number.isInteger(number) || number < 0) {
    return res.status(400).json({ error: 'turnNumber must be a non-negative integer' });
  }
  if (!turnDate) return res.status(400).json({ error: 'turnDate is required' });
  const date = new Date(turnDate);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'turnDate must be a valid date' });
  const turnDateFloor = (trip.isDiverted && trip.divertUnloadingLocation) ? trip.divertDate : trip.unloadingDate;
  if (turnDateFloor && date < turnDateFloor) {
    return res.status(400).json({ error: 'Load Turn date must be the same as or after the New Unloading/Unloading date.' });
  }

  trip.turnNumber = number;
  trip.turnDate = date;
  trip.fillingOrderLocation = fillingOrderLocation ? String(fillingOrderLocation).trim() : undefined;
  if (manualKmReturn !== undefined && manualKmReturn !== '') {
    const km = Number(manualKmReturn);
    if (!Number.isFinite(km) || km < 0) {
      return res.status(400).json({ error: 'manualKmReturn must be a non-negative number' });
    }
    trip.manualKmReturn = km;
  }
  // Manual KM Return requirement: diverted trips check filling order -> divert location;
  // non-diverted trips check filling order -> unloading location instead. Reuse only applies
  // when the reused leg targets the same destination as the return leg - Manual KM Load
  // (Loading -> Unloading) only matches when the trip isn't diverted (return target is the
  // same Unloading location); Manual KM Divert (Unloading -> divertUnloading) always matches
  // the diverted return leg's destination, so it can reuse regardless.
  if (trip.manualKmReturn == null) {
    const routeKmTable = metaRoutes.loadRouteKmTable();
    const isDivertedReturn = trip.isDiverted && trip.divertUnloadingLocation;
    const returnTarget = isDivertedReturn ? trip.divertUnloadingLocation : trip.unloadingLocation;
    if (trip.fillingOrderLocation && returnTarget) {
      const returnRouteKm = findRouteKm(routeKmTable, trip.fillingOrderLocation, returnTarget);
      if (returnRouteKm == null) {
        const reusesLoadLeg = !isDivertedReturn && trip.fillingOrderLocation === trip.loadingLocation;
        const reusesDivertLeg = isDivertedReturn && trip.fillingOrderLocation === trip.unloadingLocation;
        if (!reusesLoadLeg && !reusesDivertLeg) {
          return res.status(400).json({
            error: isDivertedReturn
              ? 'Please enter Manual KM Return between the filling order location and divert location (Round trip).'
              : 'Please enter Manual KM Return between the filling order location and unloading location (Round trip).',
          });
        }
      }
    }
  }
  await trip.save();
  res.json({ trip });
}

// PATCH /api/v1/trips/:tripId/unloading-turn   body: { turnNumber, turnDate }
async function setUnloadingTurnDetails(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { turnNumber, turnDate } = req.body;
  if (turnNumber == null || turnNumber === '') {
    return res.status(400).json({ error: 'turnNumber is required' });
  }
  const number = Number(turnNumber);
  if (!Number.isInteger(number) || number < 0) {
    return res.status(400).json({ error: 'turnNumber must be a non-negative integer' });
  }
  if (!turnDate) return res.status(400).json({ error: 'turnDate is required' });
  const date = new Date(turnDate);
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'turnDate must be a valid date' });
  if (trip.loadingDate && date < trip.loadingDate) {
    return res.status(400).json({ error: 'Unload Turn date must be the same as or after the Loading date.' });
  }

  trip.unTurnNumber = number;
  trip.unTurnDate = date;
  await trip.save();
  // Unload Turn is the other signal (besides the next trip's first diesel fill) that this trip
  // has genuinely started, so it can also unblock closing the vehicle's previous trip.
  await tryCloseVehiclePreviousTrip(trip);
  res.json({ trip });
}

// DELETE /api/v1/trips/:tripId/unloading-turn
async function deleteUnloadingTurnDetails(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  trip.unTurnNumber = undefined;
  trip.unTurnDate = undefined;
  await trip.save();
  res.json({ trip });
}

// POST /api/v1/trips/:tripId/close
async function closeTrip(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const missingRouteFields = getMissingTripRouteFields(trip);
  if (missingRouteFields.length > 0) {
    return res.status(400).json({
      error: `Cannot close trip: ${missingRouteFields.join(', ')} ${missingRouteFields.length === 1 ? 'is' : 'are'} required. Update the trip details and try again.`,
    });
  }

  const nextTrip = await Trip.findOne({
    vehicle: trip.vehicle,
    _id: { $ne: trip._id },
    createdAt: { $gt: trip.createdAt },
  }).sort({ createdAt: 1 });

  const isCustomerFinalClose = req.user.role === ROLES.CUSTOMER_ADMIN || req.user.role === ROLES.SUPER_ADMIN;
  const result = computeTripSettlement(trip, nextTrip);
  if (result.ready) {
    trip.settlement = result.settlement;
    trip.nextTrip = nextTrip?._id || null;
  } else if (nextTrip) {
    trip.nextTrip = nextTrip._id;
  }

  trip.status = isCustomerFinalClose ? TRIP_STATUS.CLOSED : TRIP_STATUS.PENDING_CLOSE;
  if (isCustomerFinalClose) trip.closedAt = getTripCloseDate(trip);
  await trip.save();

  res.json({
    trip,
    message: isCustomerFinalClose
      ? 'Trip closed successfully.'
      : 'Trip marked ready for customer close.',
  });
}

async function deleteTrip(req, res) {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip) return res.status(404).json({ error: 'Trip not found' });

  if (req.user.role === ROLES.SUPER_ADMIN) {
    await trip.deleteOne();
    return res.json({ message: 'Trip deleted successfully' });
  }

  if (req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)) {
    await trip.deleteOne();
    return res.json({ message: 'Trip deleted successfully' });
  }

  return res.status(403).json({ error: 'Only customer admins and super admins can delete trip history' });
}

module.exports = {
  createTrip,
  listTripsForVehicle,
  getTrip,
  setLoadingDetails,
  deleteLoadingExpense,
  setUnloading,
  setTurnDetails,
  setUnloadingTurnDetails,
  deleteUnloadingTurnDetails,
  closeTrip,
  deleteTrip,
};
