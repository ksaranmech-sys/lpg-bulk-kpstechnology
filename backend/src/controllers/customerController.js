// Customer CRUD handlers; also re-exports salary helpers and user/salary handlers for existing importers.
const Customer = require('../models/Customer');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const { ROLES } = require('../config/constants');

// POST /api/v1/customers   (super_admin only - onboards a new customer/subgroup)
// body: { companyName, mobileNumber, email, address, adminUsername, adminPassword }
async function createCustomer(req, res) {
  const { companyName, mobileNumber, email, address, adminUsername, adminPassword } = req.body;
  if (!companyName || !mobileNumber || !email || !adminUsername || !adminPassword) {
    return res.status(400).json({ error: 'companyName, mobileNumber, email, adminUsername, adminPassword are required' });
  }

  const customer = await Customer.create({ companyName, mobileNumber, email, address });

  const adminUser = new User({
    username: adminUsername,
    name: `${companyName} Admin`,
    role: ROLES.CUSTOMER_ADMIN,
    customer: customer._id,
  });
  await adminUser.setPassword(adminPassword);
  await adminUser.save();

  res.status(201).json({ customer, adminUser: adminUser.toSafeJSON() });
}

// GET /api/v1/customers  (super_admin only)
async function listCustomers(req, res) {
  const customers = await Customer.find().sort('-createdAt');
  res.json({ customers });
}

// GET /api/v1/customers/:customerId (super_admin only)
async function getCustomer(req, res) {
  const customer = await Customer.findById(req.params.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const [vehicles, users] = await Promise.all([
    Vehicle.find({ customer: customer._id }).sort('vehicleNumber'),
    User.find({ customer: customer._id }).sort('username'),
  ]);
  const safeUsers = users.map((user) => user.toSafeJSON());
  const driverByVehicle = new Map(
    safeUsers
      .filter((user) => user.role === ROLES.VEHICLE_USER && user.isActive !== false && user.vehicle)
      .map((user) => [String(user.vehicle), user])
  );
  const vehicleDetails = vehicles.map((vehicle) => {
    const driver = driverByVehicle.get(String(vehicle._id));
    return {
      ...vehicle.toObject(),
      driverName: driver?.displayName || driver?.name || null,
      driverMobile: driver?.mobileNumber || null,
    };
  });

  res.json({
    customer,
    vehicles: vehicleDetails,
    users: safeUsers,
  });
}

// PATCH /api/v1/customers/:customerId (super_admin only)
async function updateCustomer(req, res) {
  const { customerId } = req.params;
  const {
    companyName,
    mobileNumber,
    email,
    address,
    isActive,
    adminUsername,
    adminPassword,
    adminName,
    adminMobileNumber,
  } = req.body;

  const customer = await Customer.findById(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  if (companyName) customer.companyName = companyName.trim();
  if (mobileNumber) customer.mobileNumber = mobileNumber.trim();
  if (email) customer.email = email.trim().toLowerCase();
  if (address !== undefined) customer.address = address.trim();
  if (typeof isActive === 'boolean') customer.isActive = isActive;

  const adminUser = await User.findOne({ customer: customerId, role: ROLES.CUSTOMER_ADMIN });
  if (adminUser) {
    if (adminUsername) {
      const existing = await User.findOne({ username: adminUsername.trim().toLowerCase(), _id: { $ne: adminUser._id } });
      if (existing) {
        return res.status(409).json({ error: 'Admin username is already in use' });
      }
      adminUser.username = adminUsername.trim().toLowerCase();
    }
    if (adminName) adminUser.name = adminName.trim();
    if (adminMobileNumber) adminUser.mobileNumber = adminMobileNumber.trim();
    if (adminPassword) await adminUser.setPassword(adminPassword);
    await adminUser.save();
  }

  await customer.save();
  res.json({ customer, adminUser: adminUser ? adminUser.toSafeJSON() : null });
}

// PATCH /api/v1/customers/:customerId/status (super_admin only)
async function setCustomerStatus(req, res) {
  const { isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ error: 'isActive must be a boolean' });
  }

  const customer = await Customer.findByIdAndUpdate(
    req.params.customerId,
    { isActive },
    { new: true, runValidators: true }
  );
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  res.json({ customer });
}

// DELETE /api/v1/customers/:customerId (super_admin only)
// Customer-owned users, vehicles, and trips are removed with the customer.
async function deleteCustomer(req, res) {
  const { customerId } = req.params;
  const customer = await Customer.findById(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  await Promise.all([
    User.deleteMany({ customer: customerId }),
    Vehicle.deleteMany({ customer: customerId }),
    Trip.deleteMany({ customer: customerId }),
  ]);
  await customer.deleteOne();

  res.json({ message: 'Customer deleted successfully', customerId });
}

// POST /api/v1/customers/:customerId/vehicles  (customer_admin, or super_admin)
// body: { vehicleNumber }
async function addVehicle(req, res) {
  const { customerId } = req.params;
  const { vehicleNumber } = req.body;
  if (!vehicleNumber) return res.status(400).json({ error: 'vehicleNumber is required' });

  const vehicle = await Vehicle.create({
    customer: customerId,
    vehicleNumber: String(vehicleNumber).trim().toUpperCase(),
  });

  res.status(201).json({ vehicle });
}

module.exports = {
  ...require('../utils/salary'),
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
  addVehicle,
  ...require('./salaryController'),
  ...require('./customerUsersController'),
};
