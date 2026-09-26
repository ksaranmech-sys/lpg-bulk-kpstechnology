const VehicleExpense = require('../models/VehicleExpense');
const Vehicle = require('../models/Vehicle');
const { ROLES } = require('../config/constants');

const POPULATE_VEHICLE = ['vehicle', 'vehicleNumber'];

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

// POST /api/v1/vehicle-expenses   body: { vehicleId, category, amount, date, note }
async function createVehicleExpense(req, res) {
  const { user } = req;
  const { vehicleId, category, amount, date, note } = req.body;

  const cleanCategory = String(category || '').trim();
  if (!vehicleId || !cleanCategory || amount == null || amount === '' || !date) {
    return res.status(400).json({ error: 'vehicleId, category, amount and date are required' });
  }
  const parsedAmount = parseAmount(amount);
  if (parsedAmount == null) return res.status(400).json({ error: 'amount must be a non-negative number' });
  const parsedDate = parseDate(date);
  if (!parsedDate) return res.status(400).json({ error: 'date must be a valid date' });

  const { vehicle, error } = await resolveVehicleForUser(user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  const expense = await VehicleExpense.create({
    customer: vehicle.customer,
    vehicle: vehicle._id,
    category: cleanCategory,
    amount: parsedAmount,
    date: parsedDate,
    note: note ? String(note).trim() : undefined,
    createdBy: user.id,
  });
  const populated = await expense.populate(...POPULATE_VEHICLE);
  res.status(201).json({ expense: populated.toObject() });
}

// PATCH /api/v1/vehicle-expenses/:expenseId   body: { vehicleId?, category?, amount?, date?, note? }
async function updateVehicleExpense(req, res) {
  const { user } = req;
  const expense = await VehicleExpense.findById(req.params.expenseId);
  if (!expense) return res.status(404).json({ error: 'Vehicle expense not found' });
  if (!canManage(user, expense)) return res.status(403).json({ error: 'Not allowed to edit this vehicle expense' });

  const { vehicleId, category, amount, date, note } = req.body;
  if (vehicleId && String(vehicleId) !== String(expense.vehicle)) {
    const { vehicle, error } = await resolveVehicleForUser(user, vehicleId);
    if (error) return res.status(error.status).json({ error: error.message });
    expense.vehicle = vehicle._id;
    expense.customer = vehicle.customer;
  }
  if (category !== undefined) {
    const cleanCategory = String(category || '').trim();
    if (!cleanCategory) return res.status(400).json({ error: 'category is required' });
    expense.category = cleanCategory;
  }
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
