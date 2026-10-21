const VehicleExpense = require('../models/VehicleExpense');
const Vehicle = require('../models/Vehicle');
const { ROLES, TYRE_EXPENSE_CATEGORIES } = require('../config/constants');
const { saveUploadedFile } = require('../middleware/upload');

const POPULATE_VEHICLE = ['vehicle', 'vehicleNumber'];

function requiresTyreDetails(category) {
  return TYRE_EXPENSE_CATEGORIES.includes(String(category || '').trim().toLowerCase());
}

function customerFilterFor(req) {
  const { user } = req;
  if (user.role === ROLES.CUSTOMER_ADMIN) return { customer: user.customer };
  if (user.role === ROLES.SUPER_ADMIN && req.query.customerId) return { customer: req.query.customerId };
  if (user.role === ROLES.SUPER_ADMIN) return {};
  return null;
}

function parseAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveVehicleForUser(user, vehicleId) {
  const vehicle = await Vehicle.findById(vehicleId).select('_id customer');
  if (!vehicle) return { error: { status: 404, message: 'Vehicle not found' } };
  if (user.role === ROLES.CUSTOMER_ADMIN && String(vehicle.customer) !== String(user.customer)) {
    return { error: { status: 403, message: 'Vehicle does not belong to your account' } };
  }
  return { vehicle };
}

function canManage(user, expense) {
  if (user.role === ROLES.SUPER_ADMIN) return true;
  return user.role === ROLES.CUSTOMER_ADMIN && String(expense.customer) === String(user.customer);
}

// GET /api/v1/vehicle-expenses?customerId=&year=
// customer_admin -> own customer; super_admin -> all (optionally filtered by customerId).
async function listVehicleExpenses(req, res) {
  const filter = customerFilterFor(req);
  if (!filter) return res.status(403).json({ error: 'You do not have permission to view vehicle expenses' });

  const year = Number(req.query.year);
  if (req.query.year && Number.isInteger(year)) {
    filter.date = { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
  }

  const expenses = await VehicleExpense.find(filter).populate(...POPULATE_VEHICLE).sort('-date -createdAt');
  res.json({ expenses: expenses.map((expense) => expense.toObject()) });
}

// POST /api/v1/vehicle-expenses   body: { vehicleId, category, amount, date, note } + optional multipart `photo`
async function createVehicleExpense(req, res) {
  const { user } = req;
  const { vehicleId, category, tyreMaker, tyreModel, tyrePosition, tyreNumber, tyreNumber2, amount, date, note } = req.body;

  const cleanCategory = String(category || '').trim();
  if (!vehicleId || !cleanCategory || amount == null || amount === '' || !date) {
    return res.status(400).json({ error: 'vehicleId, category, amount and date are required' });
  }
  const cleanTyreMaker = String(tyreMaker || '').trim();
  const cleanTyreModel = String(tyreModel || '').trim();
  const cleanTyrePosition = String(tyrePosition || '').trim();
  const cleanTyreNumber = String(tyreNumber || '').trim();
  const cleanTyreNumber2 = String(tyreNumber2 || '').trim();
  if (requiresTyreDetails(cleanCategory) && (!cleanTyreMaker || !cleanTyreModel || !cleanTyrePosition || !cleanTyreNumber || !cleanTyreNumber2)) {
    return res.status(400).json({ error: 'Maker, model, tyre position, and both tyre numbers are required for tyre expenses' });
  }
  const parsedAmount = parseAmount(amount);
  if (parsedAmount == null) return res.status(400).json({ error: 'amount must be a non-negative number' });
  const parsedDate = parseDate(date);
  if (!parsedDate) return res.status(400).json({ error: 'date must be a valid date' });

  const { vehicle, error } = await resolveVehicleForUser(user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  const photo = req.file ? { url: await saveUploadedFile(req.file) } : undefined;
  const expense = await VehicleExpense.create({
    customer: vehicle.customer,
    vehicle: vehicle._id,
    category: cleanCategory,
    tyreMaker: requiresTyreDetails(cleanCategory) ? cleanTyreMaker : undefined,
    tyreModel: requiresTyreDetails(cleanCategory) ? cleanTyreModel : undefined,
    tyrePosition: requiresTyreDetails(cleanCategory) ? cleanTyrePosition : undefined,
    tyreNumber: requiresTyreDetails(cleanCategory) ? cleanTyreNumber : undefined,
    tyreNumber2: requiresTyreDetails(cleanCategory) ? cleanTyreNumber2 : undefined,
    amount: parsedAmount,
    date: parsedDate,
    note: note ? String(note).trim() : undefined,
    photo,
    createdBy: user.id,
  });
  const populated = await expense.populate(...POPULATE_VEHICLE);
  res.status(201).json({ expense: populated.toObject() });
}

// PATCH /api/v1/vehicle-expenses/:expenseId   body: { vehicleId?, category?, amount?, date?, note?, removePhoto? }
// + optional multipart `photo` (replaces the existing one).
async function updateVehicleExpense(req, res) {
  const { user } = req;
  const expense = await VehicleExpense.findById(req.params.expenseId);
  if (!expense) return res.status(404).json({ error: 'Vehicle expense not found' });
  if (!canManage(user, expense)) return res.status(403).json({ error: 'Not allowed to edit this vehicle expense' });

  const { vehicleId, category, tyreMaker, tyreModel, tyrePosition, tyreNumber, tyreNumber2, amount, date, note } = req.body;
  const cleanCategory = category === undefined ? expense.category : String(category || '').trim();
  const cleanTyreMaker = tyreMaker === undefined ? String(expense.tyreMaker || '').trim() : String(tyreMaker || '').trim();
  const cleanTyreModel = tyreModel === undefined ? String(expense.tyreModel || '').trim() : String(tyreModel || '').trim();
  const cleanTyrePosition = tyrePosition === undefined ? String(expense.tyrePosition || '').trim() : String(tyrePosition || '').trim();
  const cleanTyreNumber = tyreNumber === undefined ? String(expense.tyreNumber || '').trim() : String(tyreNumber || '').trim();
  const cleanTyreNumber2 = tyreNumber2 === undefined ? String(expense.tyreNumber2 || '').trim() : String(tyreNumber2 || '').trim();
  if (requiresTyreDetails(cleanCategory) && (!cleanTyreMaker || !cleanTyreModel || !cleanTyrePosition || !cleanTyreNumber || !cleanTyreNumber2)) {
    return res.status(400).json({ error: 'Maker, model, tyre position, and both tyre numbers are required for tyre expenses' });
  }
  if (vehicleId && String(vehicleId) !== String(expense.vehicle)) {
    const { vehicle, error } = await resolveVehicleForUser(user, vehicleId);
    if (error) return res.status(error.status).json({ error: error.message });
    expense.vehicle = vehicle._id;
    expense.customer = vehicle.customer;
  }
  if (category !== undefined) {
    expense.category = cleanCategory;
  }
  expense.tyreMaker = requiresTyreDetails(cleanCategory) ? cleanTyreMaker : undefined;
  expense.tyreModel = requiresTyreDetails(cleanCategory) ? cleanTyreModel : undefined;
  expense.tyrePosition = requiresTyreDetails(cleanCategory) ? cleanTyrePosition : undefined;
  expense.tyreNumber = requiresTyreDetails(cleanCategory) ? cleanTyreNumber : undefined;
  expense.tyreNumber2 = requiresTyreDetails(cleanCategory) ? cleanTyreNumber2 : undefined;
  if (amount !== undefined) {
    const parsedAmount = parseAmount(amount);
    if (parsedAmount == null) return res.status(400).json({ error: 'amount must be a non-negative number' });
    expense.amount = parsedAmount;
  }
  if (date !== undefined) {
    const parsedDate = parseDate(date);
    if (!parsedDate) return res.status(400).json({ error: 'date must be a valid date' });
    expense.date = parsedDate;
  }
  if (note !== undefined) expense.note = note ? String(note).trim() : undefined;
  if (req.file) {
    expense.photo = { url: await saveUploadedFile(req.file) };
  } else if (req.body.removePhoto === true || req.body.removePhoto === 'true') {
    expense.photo = undefined;
  }

  await expense.save();
  const populated = await expense.populate(...POPULATE_VEHICLE);
  res.json({ expense: populated.toObject() });
}

// DELETE /api/v1/vehicle-expenses/:expenseId
async function deleteVehicleExpense(req, res) {
  const { user } = req;
  const expense = await VehicleExpense.findById(req.params.expenseId);
  if (!expense) return res.status(404).json({ error: 'Vehicle expense not found' });
  if (!canManage(user, expense)) return res.status(403).json({ error: 'Not allowed to delete this vehicle expense' });

  await expense.deleteOne();
  res.json({ message: 'Vehicle expense deleted successfully', expenseId: req.params.expenseId });
}

module.exports = { listVehicleExpenses, createVehicleExpense, updateVehicleExpense, deleteVehicleExpense };
