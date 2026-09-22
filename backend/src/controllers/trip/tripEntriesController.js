// Trip entry handlers: driver advances, diesel fills, RTO expenses, other expenses.
const Vehicle = require('../../models/Vehicle');
const { saveUploadedFile } = require('../../middleware/upload');
const {
  validateEntryDate,
  hasValidGpsCoordinates,
  tryCloseVehiclePreviousTrip,
  refreshRelatedSettlements,
  getOpenTripOr404,
} = require('./tripHelpers');

// POST /api/v1/trips/:tripId/advances   body: { amount, date }
async function addAdvance(req, res) {
  const trip = await getOpenTripOr404(req, res);
  if (!trip) return;
  const date = req.body.date ? new Date(req.body.date) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date must be a valid date' });
  const dateError = await validateEntryDate(trip, date, 'Advance');
  if (dateError) return res.status(400).json({ error: dateError });
  trip.driverAdvances.push({ amount: req.body.amount, date });
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
  if (req.body.date) {
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date must be a valid date' });
    const dateError = await validateEntryDate(trip, date, 'Advance');
    if (dateError) return res.status(400).json({ error: dateError });
    advance.date = date;
  }
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

  // GPS is optional - when present it lets same-day next-trip fills at one pump be grouped.
  const hasGps = hasValidGpsCoordinates(lat, lng);
  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: hasGps ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  const volume = Number(volumeLitres);
  const amount = totalValue != null ? Number(totalValue) : volume * Number(ratePerLitre);
  const calculatedRate = amount / volume;
  if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'volumeLitres and totalValue must be valid positive numbers' });
  }

  const dieselDate = filledAt ? new Date(filledAt) : new Date();
  if (Number.isNaN(dieselDate.getTime())) return res.status(400).json({ error: 'filledAt must be a valid date' });
  const dieselDateError = await validateEntryDate(trip, dieselDate, 'Diesel');
  if (dieselDateError) return res.status(400).json({ error: dieselDateError });

  trip.dieselEntries.push({
    volumeLitres: volume,
    ratePerLitre: calculatedRate,
    amount,
    paymentMethod,
    loadingPointTankFill: loadingPointTankFill === true || loadingPointTankFill === 'true',
    odometerKm: odometerKm != null && odometerKm !== '' ? Number(odometerKm) : null,
    filledAt: dieselDate,
    gps: hasGps ? { lat: Number(lat), lng: Number(lng) } : undefined,
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
    const dieselDateError = await validateEntryDate(trip, filledAt, 'Diesel');
    if (dieselDateError) return res.status(400).json({ error: dieselDateError });
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

  const { amount, date: rawDate, lat, lng } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  const date = rawDate ? new Date(rawDate) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date must be a valid date' });
  const dateError = await validateEntryDate(trip, date, 'RTO');
  if (dateError) return res.status(400).json({ error: dateError });

  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  trip.rtoEntries.push({ amount: Number(amount), date, photo });
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
    const dateError = await validateEntryDate(trip, date, 'RTO');
    if (dateError) return res.status(400).json({ error: dateError });
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

  const { amount, date: rawDate, description, lat, lng } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });
  const date = rawDate ? new Date(rawDate) : new Date();
  if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date must be a valid date' });
  const dateError = await validateEntryDate(trip, date, 'Other Expense');
  if (dateError) return res.status(400).json({ error: dateError });

  let photo;
  if (req.file) {
    const url = await saveUploadedFile(req.file);
    photo = { url, gps: lat && lng ? { lat: Number(lat), lng: Number(lng) } : undefined };
  }

  trip.otherExpenses.push({ amount: Number(amount), date, description, photo });
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
  if (req.body.date) {
    const date = new Date(req.body.date);
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'date must be a valid date' });
    const dateError = await validateEntryDate(trip, date, 'Other Expense');
    if (dateError) return res.status(400).json({ error: dateError });
    expense.date = date;
  }
  expense.amount = amount;
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

module.exports = {
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
};
