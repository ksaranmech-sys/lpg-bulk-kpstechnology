// Vehicle-user (driver) management under a customer: create, update, delete, bulk operations.
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Leave = require('../models/Leave');
const { ROLES } = require('../config/constants');

// Validates the optional temporaryDriver block shared by createVehicleUser/updateVehicleUser.
// Returns { value, error } - value is undefined when the caller didn't send temporaryDriver at all,
// so an update request that omits it leaves the existing value untouched.
function parseTemporaryDriver(temporaryDriver) {
  if (temporaryDriver === undefined) return {};
  const required = Boolean(temporaryDriver?.required);
  if (!required) {
    return { value: { required: false, name: null, joiningDate: null, returningDate: null } };
  }

  const name = String(temporaryDriver?.name || '').trim();
  if (!name) return { error: 'Temporary driver name is required' };

  const joiningDate = new Date(temporaryDriver?.joiningDate);
  if (!temporaryDriver?.joiningDate || Number.isNaN(joiningDate.getTime())) {
    return { error: 'Temporary driver joining date is required' };
  }

  // Returning date isn't known upfront - it gets filled in later once the temporary driver
  // actually hands the vehicle back, so it's optional here but validated if supplied.
  let returningDate = null;
  if (temporaryDriver?.returningDate) {
    returningDate = new Date(temporaryDriver.returningDate);
    if (Number.isNaN(returningDate.getTime())) {
      return { error: 'Temporary driver returning date must be a valid date' };
    }
    if (returningDate < joiningDate) {
      return { error: 'Temporary driver returning date cannot be before the joining date' };
    }
  }

  return { value: { required: true, name, joiningDate, returningDate } };
}

// POST /api/v1/customers/:customerId/users  (customer_admin creates a vehicle_user)
// body: { username, password, name, mobileNumber, joiningDate, resigningDate, vehicleId, basicSalary, kmCharges, minKmCharges }
async function createVehicleUser(req, res) {
  const { customerId } = req.params;
  const { username, password, name, mobileNumber, joiningDate, resigningDate, vehicleId, basicSalary, kmCharges, minKmCharges, temporaryDriver } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
  }

  const parsedTemporaryDriver = parseTemporaryDriver(temporaryDriver);
  if (parsedTemporaryDriver.error) {
    return res.status(400).json({ error: parsedTemporaryDriver.error });
  }

  if (vehicleId) {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, customer: customerId });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found under this customer' });
    await User.updateMany(
      { customer: customerId, role: ROLES.VEHICLE_USER, vehicle: vehicleId, isActive: true },
      { $set: { isActive: false, resigningDate: new Date() } }
    );
  }

  const user = new User({
    username,
    name,
    mobileNumber,
    joiningDate: joiningDate || null,
    resigningDate: resigningDate || null,
    basicSalary,
    kmCharges,
    minKmCharges,
    temporaryDriver: parsedTemporaryDriver.value,
    role: ROLES.VEHICLE_USER,
    customer: customerId,
    vehicle: vehicleId || null,
  });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ user: user.toSafeJSON() });
}

// PATCH /api/v1/customers/:customerId/users/:userId  (customer_admin updates vehicle_user)
async function updateVehicleUser(req, res) {
  const { customerId, userId } = req.params;
  const { name, mobileNumber, joiningDate, resigningDate, username, password, vehicleId, basicSalary, kmCharges, minKmCharges, temporaryDriver } = req.body;

  const user = await User.findOne({ _id: userId, customer: customerId, role: ROLES.VEHICLE_USER });
  if (!user) return res.status(404).json({ error: 'Driver user not found' });

  const parsedTemporaryDriver = parseTemporaryDriver(temporaryDriver);
  if (parsedTemporaryDriver.error) {
    return res.status(400).json({ error: parsedTemporaryDriver.error });
  }

  if (vehicleId !== undefined && vehicleId !== null && vehicleId !== '') {
    const vehicle = await Vehicle.findOne({ _id: vehicleId, customer: customerId });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found under this customer' });
    await User.updateMany(
      { customer: customerId, role: ROLES.VEHICLE_USER, vehicle: vehicleId, isActive: true, _id: { $ne: user._id } },
      { $set: { isActive: false, resigningDate: new Date() } }
    );
    user.vehicle = vehicleId;
  } else if (vehicleId === '') {
    user.vehicle = null;
  }
  if (name !== undefined) user.name = name.trim();
  if (mobileNumber !== undefined) user.mobileNumber = mobileNumber.trim();
  if (joiningDate !== undefined) user.joiningDate = joiningDate || null;
  if (resigningDate !== undefined) user.resigningDate = resigningDate || null;
  if (basicSalary !== undefined) user.basicSalary = basicSalary;
  if (kmCharges !== undefined) user.kmCharges = kmCharges;
  if (minKmCharges !== undefined) user.minKmCharges = minKmCharges;
  if (parsedTemporaryDriver.value) user.temporaryDriver = parsedTemporaryDriver.value;
  if (username) {
    const normalized = username.trim().toLowerCase();
    const existing = await User.findOne({ username: normalized, _id: { $ne: user._id } });
    if (existing) return res.status(409).json({ error: 'Driver username is already in use' });
    user.username = normalized;
  }
  if (password) await user.setPassword(password);

  await user.save();
  res.json({ user: user.toSafeJSON() });
}

// DELETE /api/v1/customers/:customerId/users/:userId  (permanently remove vehicle_user)
async function deleteVehicleUser(req, res) {
  const { customerId, userId } = req.params;

  const user = await User.findOne({ _id: userId, customer: customerId, role: ROLES.VEHICLE_USER });
  if (!user) return res.status(404).json({ error: 'Driver user not found' });

  await Leave.deleteMany({ driver: user._id });
  await user.deleteOne();
  res.json({ message: 'Driver deleted successfully', userId });
}

// PATCH /api/v1/customers/:customerId/users/bulk
// body: { updates: [{ userId, name, mobileNumber }] }
async function bulkUpdateVehicleUsers(req, res) {
  const { customerId } = req.params;
  const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
  if (!updates.length) return res.status(400).json({ error: 'updates are required' });

  const updatedUsers = [];
  for (const update of updates) {
    const user = await User.findOne({
      _id: update.userId,
      customer: customerId,
      role: ROLES.VEHICLE_USER,
    });
    if (!user) return res.status(404).json({ error: 'Driver user not found' });

    if (update.name !== undefined) user.name = String(update.name).trim();
    if (update.mobileNumber !== undefined) user.mobileNumber = String(update.mobileNumber).trim();
    await user.save();
    updatedUsers.push(user.toSafeJSON());
  }

  res.json({ users: updatedUsers });
}

// DELETE /api/v1/customers/:customerId/users/bulk
// body: { userIds: [userId] }
async function bulkDeleteVehicleUsers(req, res) {
  const { customerId } = req.params;
  const userIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];
  if (!userIds.length) return res.status(400).json({ error: 'userIds are required' });

  const users = await User.find({ _id: { $in: userIds }, customer: customerId, role: ROLES.VEHICLE_USER }).select('_id');
  await Leave.deleteMany({ driver: { $in: users.map((u) => u._id) } });
  const result = await User.deleteMany({ _id: { $in: userIds }, customer: customerId, role: ROLES.VEHICLE_USER });
  res.json({ deletedCount: result.deletedCount });
}

module.exports = {
  createVehicleUser,
  updateVehicleUser,
  deleteVehicleUser,
  bulkUpdateVehicleUsers,
  bulkDeleteVehicleUsers,
};
