const Trip = require('../models/Trip');
const Vehicle = require('../models/Vehicle');
const Customer = require('../models/Customer');
const { saveUploadedFile } = require('../middleware/upload');
const { computeTripSettlement, calculateClosingOdometerKm } = require('../utils/tripCalculations');
const { buildTripSettlementPdf } = require('../utils/pdfGenerator');
const { sendTripSettlementEmail } = require('../utils/mailer');
const { TRIP_STATUS, ROLES } = require('../config/constants');
const User = require('../models/User');
const { removeExpiredClosedTrips } = require('../utils/tripRetention');
const metaRoutes = require('../routes/metaRoutes');
const { getCorporationKmDetails, findRouteKm } = require('../utils/corporationKm');

function getClosingDieselDate(trip, fallback = null) {
  const closingEntry = trip.dieselEntries?.[trip.dieselEntries.length - 1];
  const filledAt = closingEntry?.filledAt ? new Date(closingEntry.filledAt) : null;
  return filledAt && !Number.isNaN(filledAt.getTime()) ? filledAt : fallback;
}

function getTripCloseDate(trip) {
  const turnDate = trip.turnDate ? new Date(trip.turnDate) : null;
  if (turnDate && !Number.isNaN(turnDate.getTime())) return turnDate;
  return getClosingDieselDate(trip);
}

// Loading/unloading location + date are compulsory before a trip can close.
const REQUIRED_CLOSE_FIELDS = [
  ['loadingLocation', 'loading location'],
  ['loadingDate', 'loading date'],
  ['unloadingLocation', 'unloading location'],
  ['unloadingDate', 'unloading date'],
];

function getMissingTripRouteFields(trip) {
  return REQUIRED_CLOSE_FIELDS
    .filter(([field]) => {
      const value = trip?.[field];
      if (typeof value === 'string') return value.trim() === '';
      return value == null;
    })
    .map(([, label]) => label);
}

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

  const trip = await Trip.create({
    customer: vehicle.customer,
    vehicle: vehicle._id,
    ...(loadingLocation ? { loadingLocation: loadingLocation.trim() } : {}),
    loadingExpense: loadingExpense || 0,
    driverAdvances: driverAdvances || [],
    createdBy: req.user.id,
  });

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
  const driver = await User.findOne({ role: ROLES.VEHICLE_USER, vehicle: trip.vehicle._id }).select('name');
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
  result.driverName = driver?.name || null;
  res.json({ trip: result });
}

// POST /api/v1/trips/:tripId/advances   body: { amount, date }
async function addAdvance(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;
  trip.driverAdvances.push({ amount: req.body.amount, date: req.body.date || new Date() });
  await trip.save();
  res.status(201).json({ trip });

  // fire-and-forget: nothing to recalc, advance doesn't affect diesel/km
}

// PATCH /api/v1/trips/:tripId/advances/:advanceIndex   body: { amount, date }
async function updateAdvance(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.advanceIndex);
  const advance = trip.driverAdvances[index];
  if (!Number.isInteger(index) || index < 0 || !advance) {
    return res.status(404).json({ error: 'Driver advance not found' });
  }
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }
  advance.amount = amount;
  if (req.body.date) advance.date = req.body.date;
  await trip.save();
  res.json({ trip });
}

// DELETE /api/v1/trips/:tripId/advances/:advanceIndex
async function deleteAdvance(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.advanceIndex);
  if (!Number.isInteger(index) || index < 0 || !trip.driverAdvances[index]) {
    return res.status(404).json({ error: 'Driver advance not found' });
  }
  trip.driverAdvances.splice(index, 1);
  await trip.save();
  res.json({ trip });
}

// POST /api/v1/trips/:tripId/diesel  (multipart/form-data: photo, volumeLitres, ratePerLitre, odometerKm, filledAt, lat, lng)
async function addDieselEntry(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { volumeLitres, ratePerLitre, totalValue, paymentMethod = 'diesel_card', loadingPointTankFill, odometerKm, filledAt, lat, lng } = req.body;
  if (!volumeLitres || (totalValue == null && !ratePerLitre)) {
    return res.status(400).json({ error: 'volumeLitres and totalValue are required' });
  }
  if (!['diesel_card', 'cash'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'paymentMethod must be diesel_card or cash' });
  }

  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  const volume = Number(volumeLitres);
  const amount = totalValue != null ? Number(totalValue) : volume * Number(ratePerLitre);
  const calculatedRate = amount / volume;
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'volumeLitres and totalValue must be valid positive numbers' });
  }

  trip.dieselEntries.push({
    volumeLitres: volume,
    ratePerLitre: calculatedRate,
    amount,
    paymentMethod,
    loadingPointTankFill: loadingPointTankFill === true || loadingPointTankFill === 'true',
    odometerKm: odometerKm != null && odometerKm !== '' ? Number(odometerKm) : null,
    filledAt: filledAt || new Date(),
    photo,
  });
  await trip.save();

  if (odometerKm != null) {
    await Vehicle.findByIdAndUpdate(trip.vehicle, { lastKnownOdometer: Number(odometerKm) });
  }

  // This diesel fill might be the FIRST fill of a brand-new trip, which is
  // exactly the event that closes the vehicle's previous open trip. Try to
  // settle the previous trip now.
  if (trip.dieselEntries.length === 1) {
    await tryCloseVehiclePreviousTrip(trip);
  }
  await refreshRelatedSettlements(trip);

  res.status(201).json({ trip });
}

// PATCH /api/v1/trips/:tripId/diesel/:dieselIndex
async function updateDieselEntry(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.dieselIndex);
  const entry = trip.dieselEntries[index];
  if (!Number.isInteger(index) || index < 0 || !entry) {
    return res.status(404).json({ error: 'Diesel entry not found' });
  }

  const volume = Number(req.body.volumeLitres);
  const amount = Number(req.body.totalValue);
  const paymentMethod = req.body.paymentMethod || entry.paymentMethod || 'diesel_card';
  const loadingPointTankFill = req.body.loadingPointTankFill === true || req.body.loadingPointTankFill === 'true';
  const odometerKm = req.body.odometerKm != null && req.body.odometerKm !== '' ? Number(req.body.odometerKm) : null;
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'volumeLitres and totalValue must be valid numbers' });
  }
  if (!['diesel_card', 'cash'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'paymentMethod must be diesel_card or cash' });
  }
  if (odometerKm != null && (!Number.isFinite(odometerKm) || odometerKm < 0)) {
    return res.status(400).json({ error: 'odometerKm must be a non-negative number' });
  }

  entry.volumeLitres = volume;
  entry.amount = amount;
  entry.ratePerLitre = amount / volume;
  entry.paymentMethod = paymentMethod;
  entry.loadingPointTankFill = loadingPointTankFill;
  entry.odometerKm = odometerKm;
  if (req.body.filledAt) {
    const filledAt = new Date(req.body.filledAt);
    if (Number.isNaN(filledAt.getTime())) {
      return res.status(400).json({ error: 'filledAt must be a valid date' });
    }
    entry.filledAt = filledAt;
  }
  await trip.save();
  await refreshRelatedSettlements(trip);

  if (odometerKm != null) {
    await Vehicle.findByIdAndUpdate(trip.vehicle, { lastKnownOdometer: Number(odometerKm) });
  }

  res.json({ trip });
}

async function deleteDieselEntry(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.dieselIndex);
  if (!Number.isInteger(index) || index < 0 || !trip.dieselEntries[index]) {
    return res.status(404).json({ error: 'Diesel entry not found' });
  }

  trip.dieselEntries.splice(index, 1);
  await trip.save();
  await refreshRelatedSettlements(trip);
  res.json({ trip });
}

// POST /api/v1/trips/:tripId/rto  (multipart/form-data: photo, amount, date, lat, lng)
async function addRtoEntry(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { amount, date, lat, lng } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  trip.rtoEntries.push({ amount: Number(amount), date: date || new Date(), photo });
  await trip.save();
  res.status(201).json({ trip });
}

// PATCH /api/v1/trips/:tripId/rto/:rtoIndex
async function updateRtoEntry(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.rtoIndex);
  const entry = trip.rtoEntries[index];
  if (!Number.isInteger(index) || index < 0 || !entry) {
    return res.status(404).json({ error: 'RTO expense not found' });
  }

  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }
  if (req.body.date !== undefined) {
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'date must be a valid date' });
    }
    entry.date = date;
  }
  entry.amount = amount;
  await trip.save();
  res.json({ trip });
}

// POST /api/v1/trips/:tripId/other-expenses (multipart/form-data: photo, amount, date, description)
async function addOtherExpense(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const { amount, date, description, lat, lng } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  trip.otherExpenses.push({ amount: Number(amount), date: date || new Date(), description, photo });
  await trip.save();
  res.status(201).json({ trip });
}

// PATCH /api/v1/trips/:tripId/other-expenses/:expenseIndex
async function updateOtherExpense(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.expenseIndex);
  const expense = trip.otherExpenses[index];
  if (!Number.isInteger(index) || index < 0 || !expense) {
    return res.status(404).json({ error: 'Other expense not found' });
  }

  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'amount must be a non-negative number' });
  }
  expense.amount = amount;
  expense.date = req.body.date ? new Date(req.body.date) : expense.date;
  expense.description = req.body.description || '';
  await trip.save();
  res.json({ trip });
}

async function deleteOtherExpense(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;

  const index = Number(req.params.expenseIndex);
  if (!Number.isInteger(index) || index < 0 || !trip.otherExpenses[index]) {
    return res.status(404).json({ error: 'Other expense not found' });
  }

  trip.otherExpenses.splice(index, 1);
  await trip.save();
  res.json({ trip });
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
      trip.divertUnloadingLocation = location;
      trip.divertDate = date;
      // Same rule for the divert leg: unloading -> new unloading must resolve from the KM
      // table, or its own Manual KM Divert fallback must be supplied.
      if (trip.manualKmDivert == null) {
        const divertRouteKm = findRouteKm(metaRoutes.loadRouteKmTable(), trip.unloadingLocation, trip.divertUnloadingLocation);
        if (divertRouteKm == null) {
          return res.status(400).json({
            error: 'Please enter Manual KM Divert between the unloading location and new unloading location (Round trip).',
          });
        }
      }
    } else {
      trip.divertUnloadingLocation = null;
      trip.divertDate = null;
    }
  }
  await trip.save();
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
  // Manual KM Return requirement: diverted trips check filling order -> new unloading location;
  // non-diverted trips check filling order -> unloading location instead.
  if (trip.manualKmReturn == null) {
    if (trip.isDiverted && trip.divertUnloadingLocation) {
      if (trip.fillingOrderLocation) {
        const returnRouteKm = findRouteKm(metaRoutes.loadRouteKmTable(), trip.fillingOrderLocation, trip.divertUnloadingLocation);
        if (returnRouteKm == null) {
          return res.status(400).json({
            error: 'Please enter Manual KM Return between the filling order location and new unloading location (Round trip).',
          });
        }
      }
    } else {
      const returnRouteKm = findRouteKm(metaRoutes.loadRouteKmTable(), trip.fillingOrderLocation, trip.unloadingLocation);
      if (returnRouteKm == null) {
        return res.status(400).json({
          error: 'Please enter Manual KM Return between the filling order location and unloading location (Round trip).',
        });
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

  trip.unTurnNumber = number;
  trip.unTurnDate = date;
  await trip.save();
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

/**
 * Shared logic: whenever a new trip's first diesel entry is saved, look up
 * the vehicle's previous OPEN trip and attempt to compute + finalize its
 * settlement now that we have the "next trip first fill" data point we need.
 */
async function tryCloseVehiclePreviousTrip(newTrip) {
  const previousTrip = await Trip.findOne({
    vehicle: newTrip.vehicle,
    status: { $in: [TRIP_STATUS.OPEN, TRIP_STATUS.PENDING_CLOSE] },
    _id: { $ne: newTrip._id },
  }).sort('-createdAt');

  if (!previousTrip) return; // this is the very first trip ever for the vehicle

  // Never auto-close a trip whose route details are incomplete - leave it
  // open so someone can fill in loading/unloading info and close it manually.
  if (getMissingTripRouteFields(previousTrip).length > 0) return;

  const result = computeTripSettlement(previousTrip, newTrip);
  if (!result.ready) return; // not enough data yet - leave open

  previousTrip.settlement = result.settlement;
  previousTrip.status = TRIP_STATUS.CLOSED;
  previousTrip.closedAt = getClosingDieselDate(newTrip);
  previousTrip.nextTrip = newTrip._id;
  await previousTrip.save();
}

async function refreshRelatedSettlements(trip) {
  if (trip.status !== TRIP_STATUS.CLOSED) {
    const previousClosedTrip = await Trip.findOne({
      vehicle: trip.vehicle,
      status: TRIP_STATUS.CLOSED,
      createdAt: { $lt: trip.createdAt },
    }).sort('-createdAt');
    if (previousClosedTrip && String(previousClosedTrip.nextTrip || '') === String(trip._id)) {
      await refreshTripSettlement(previousClosedTrip);
    }
    return;
  }
  await refreshTripSettlement(trip);
}

async function refreshTripSettlement(trip) {
  const nextTrip = await Trip.findOne({
    vehicle: trip.vehicle,
    _id: { $ne: trip._id },
    createdAt: { $gt: trip.createdAt },
  }).sort({ createdAt: 1 });
  const result = computeTripSettlement(trip, nextTrip);
  if (!result.ready) return;
  trip.settlement = result.settlement;
  trip.nextTrip = nextTrip?._id || trip.nextTrip;
  await trip.save();
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

// POST /api/v1/trips/:tripId/send-report
// Generates the printable PDF settlement and emails it to the company (and
// optionally the customer). Trip must already be closed/settled.
async function sendReport(req, res) {
  const trip = await Trip.findById(req.params.tripId)
    .populate('vehicle', 'vehicleNumber')
    .populate('customer', 'companyName email');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  const previousTrip = await Trip.findOne({
    vehicle: trip.vehicle._id,
    createdAt: { $lt: trip.createdAt },
  }).sort('-createdAt');

  if (trip.status !== TRIP_STATUS.CLOSED || !trip.settlement?.calculatedAt) {
    return res.status(400).json({
      error: 'Trip is not settled yet - it closes automatically once the next trip records its first diesel fill.',
    });
  }

  const pdfBuffer = await buildTripSettlementPdf(trip, previousTrip);
  const companyEmail = process.env.COMPANY_EMAIL;
  const customerEmail = trip.customer?.email;

  const info = await sendTripSettlementEmail({
    to: companyEmail,
    cc: customerEmail,
    subject: `Trip Settlement Report - ${trip.vehicle?.vehicleNumber} - ${trip._id}`,
    html: `<p>Attached is the settlement report for vehicle <b>${trip.vehicle?.vehicleNumber}</b>.</p>`,
    pdfBuffer,
    pdfFilename: `trip-settlement-${trip._id}.pdf`,
  });

  trip.reportSentAt = new Date();
  trip.reportSentTo = [companyEmail, customerEmail].filter(Boolean).join(', ');
  await trip.save();

  res.json({ message: 'Report emailed successfully', messageId: info.messageId });
}

// GET /api/v1/trips/:tripId/report  -> streams the PDF directly (for on-screen "print" button)
async function downloadReport(req, res) {
  const trip = await Trip.findById(req.params.tripId)
    .populate('vehicle', 'vehicleNumber')
    .populate('customer', 'companyName email');
  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  if (trip.status === TRIP_STATUS.CLOSED) await refreshTripSettlement(trip);
  const previousTrip = await Trip.findOne({
    vehicle: trip.vehicle._id,
    createdAt: { $lt: trip.createdAt },
  }).sort('-createdAt');

  const pdfBuffer = await buildTripSettlementPdf(trip, previousTrip);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="trip-${trip._id}.pdf"`);
  res.send(pdfBuffer);
}

async function getOpenTripOr404(req, res) {
  const trip = await Trip.findById(req.params.tripId);
  if (!trip) {
    res.status(404).json({ error: 'Trip not found' });
    return null;
  }

  if (req.user.role === ROLES.SUPER_ADMIN) return trip;
  if (req.user.role === ROLES.CUSTOMER_ADMIN && String(trip.customer) === String(req.user.customer)) return trip;

  const currentUser = req.user.role === ROLES.VEHICLE_USER
    ? await User.findById(req.user.id).select('role vehicle isActive')
    : null;
  const assignedVehicle = currentUser?.vehicle || req.user.vehicle;
  if (
    req.user.role !== ROLES.VEHICLE_USER ||
    currentUser?.role !== ROLES.VEHICLE_USER ||
    !currentUser.isActive ||
    String(trip.vehicle) !== String(assignedVehicle)
  ) {
    res.status(403).json({ error: 'Only the assigned user can edit an open trip' });
    return null;
  }
  return trip;
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
  getClosingDieselDate,
  getMissingTripRouteFields,
  createTrip,
  listTripsForVehicle,
  getTrip,
  addAdvance,
  updateAdvance,
  deleteAdvance,
  addDieselEntry,
  updateDieselEntry,
  deleteDieselEntry,
  addRtoEntry,
  updateRtoEntry,
  addOtherExpense,
  updateOtherExpense,
  deleteOtherExpense,
  setLoadingDetails,
  deleteLoadingExpense,
  setUnloading,
  setTurnDetails,
  setUnloadingTurnDetails,
  deleteUnloadingTurnDetails,
  closeTrip,
  sendReport,
  downloadReport,
  deleteTrip,
};
