const Customer = require('../models/Customer');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const fs = require('fs');
const path = require('path');
const { ROLES } = require('../config/constants');
const { buildDriverMonthlySummaryPdf, formatMonth } = require('../utils/pdfGenerator');
const Leave = require('../models/Leave');
const { findRouteKm, getCorporationKmDetails } = require('../utils/corporationKm');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round0(value) {
  return Math.round(Number(value || 0));
}

function loadRouteKmTable() {
  const filePath = path.join(__dirname, '../config/routeKmTable.json');
  try {
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    return [];
  }
}

function calculateTripExpense(trip) {
  const rtoExpense = (trip.rtoEntries || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const otherExpense = (trip.otherExpenses || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  return Number(trip.loadingExpense || 0) + Number(trip.unloadingExpense || 0) + rtoExpense + otherExpense;
}

function calculateTripBalance(trip) {
  const totalAdvance = (trip.driverAdvances || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const totalExpense = calculateTripExpense(trip);
  return Math.round((totalAdvance - totalExpense + Number.EPSILON) * 100) / 100;
}

function sumTripBalances(trips) {
  const total = trips.reduce((sum, trip) => (
    sum + (trip.settlement?.balance != null ? Number(trip.settlement.balance) : calculateTripBalance(trip))
  ), 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function sumTripAdvances(trips) {
  return trips.reduce((sum, trip) => (
    sum + (trip.driverAdvances || []).reduce((total, entry) => total + Number(entry.amount || 0), 0)
  ), 0);
}

function sumTripDiesel(trips) {
  return trips.reduce((sum, trip) => (
    sum + (trip.dieselEntries || []).reduce((total, entry) => total + Number(entry.amount || 0), 0)
  ), 0);
}

function sumTripDieselLitres(trips) {
  return trips.reduce((sum, trip) => (
    sum + (trip.dieselEntries || []).reduce((total, entry) => total + Number(entry.volumeLitres || 0), 0)
  ), 0);
}

function sumTripExpenses(trips) {
  return trips.reduce((sum, trip) => sum + calculateTripExpense(trip), 0);
}

function getSalaryMonthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: new Date(year, monthNumber - 1, 1),
    end: new Date(year, monthNumber, 1),
  };
}

function getClosedTripsMonthFilter(monthStart, monthEnd) {
  // Still-open trips are included too, so the admin can see and manually close them from the
  // salary table instead of waiting for the automatic next-trip close.
  return { status: { $in: ['open', 'pending_close', 'closed'] } };
}

function getTripClosedDate(trip) {
  const turnDate = trip.turnDate ? new Date(trip.turnDate) : null;
  if (turnDate && !Number.isNaN(turnDate.getTime())) return turnDate;

  const entries = trip.dieselEntries || [];
  const filledAt = entries[entries.length - 1]?.filledAt ? new Date(entries[entries.length - 1].filledAt) : null;
  if (filledAt && !Number.isNaN(filledAt.getTime())) return filledAt;

  const closedAt = trip.closedAt ? new Date(trip.closedAt) : null;
  if (closedAt && !Number.isNaN(closedAt.getTime())) return closedAt;

  // Still-open trips have no close-related date yet - fall back to the loading date so they
  // still show up (with a checkbox to manually close them) in the month they were started.
  const loadingDate = trip.loadingDate ? new Date(trip.loadingDate) : null;
  return loadingDate && !Number.isNaN(loadingDate.getTime()) ? loadingDate : null;
}

function isTripInSalaryMonth(trip, monthStart, monthEnd) {
  const closedDate = getTripClosedDate(trip);
  return closedDate && closedDate >= monthStart && closedDate < monthEnd;
}

function sumRouteTableKm(trips, routeKmTable, excludeShortTrips = false) {
  return trips.reduce((total, trip) => {
    const routeKm = getTripCorporationKm(trip, routeKmTable);
    if (!Number.isFinite(routeKm) || (excludeShortTrips && routeKm < 200)) return total;
    return total + routeKm;
  }, 0);
}

function getTripCorporationKm(trip, routeKmTable) {
  return getCorporationKmDetails(trip, routeKmTable).value;
}

function calculateSpecialTripCharges(trips, routeKmTable) {
  const shortTripCount = trips.reduce((count, trip) => {
    const route = routeKmTable.find((row) => (
      String(row.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
      String(row.unloadingLocation || '').trim() === String(trip.unloadingLocation || '').trim()
    ));
    return count + (route && Number(route.km) < 200 ? 1 : 0);
  }, 0);
  return {
    specialTripCount: shortTripCount,
    specialTripCharges: shortTripCount * 1000,
  };
}

function getCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateBasicSalary(month, monthlyBasicSalary, joiningDate, resigningDate, leaves = []) {
  const { start: monthStart, end: monthEndExclusive } = getSalaryMonthBounds(month);
  const monthEnd = new Date(monthEndExclusive.getTime() - MS_PER_DAY);
  const daysInMonth = monthEnd.getDate();
  const joiningDay = joiningDate ? getCalendarDay(new Date(joiningDate)) : null;
  const resigningDay = resigningDate ? getCalendarDay(new Date(resigningDate)) : null;
  const payableStart = joiningDay && joiningDay > monthStart ? joiningDay : monthStart;
  const payableEnd = resigningDay && resigningDay < monthEnd ? resigningDay : monthEnd;

  const employedDays = payableEnd >= payableStart
    ? Math.floor((payableEnd - payableStart) / MS_PER_DAY) + 1
    : 0;
  const leaveDays = new Set();
  leaves.forEach((leave) => {
    const leaveStart = getCalendarDay(new Date(leave.startDate));
    const leaveEnd = getCalendarDay(new Date(leave.endDate));
    const start = leaveStart > payableStart ? leaveStart : payableStart;
    const end = leaveEnd < payableEnd ? leaveEnd : payableEnd;
    for (let day = start; day <= end; day = new Date(day.getTime() + MS_PER_DAY)) {
      leaveDays.add(day.getTime());
    }
  });
  const unpaidLeaveDays = Math.min(leaveDays.size, employedDays);
  const payableDays = Math.max(employedDays - unpaidLeaveDays, 0);

  const basicSalary = Number(monthlyBasicSalary || 0);
  return {
    daysInMonth,
    payableDays,
    unpaidLeaveDays,
    basicSalary: round0((basicSalary / daysInMonth) * payableDays),
  };
}

async function calculateDriverMonthlySalary(customerId, userId, month) {
  const driver = await User.findOne({
    _id: userId,
    customer: customerId,
    role: ROLES.VEHICLE_USER,
  }).select('name username basicSalary kmCharges minKmCharges joiningDate resigningDate vehicle');
  if (!driver) return null;

  const { start: monthStart, end: monthEnd } = getSalaryMonthBounds(month);
  const leaves = await Leave.find({
    customer: customerId,
    driver: userId,
    startDate: { $lt: monthEnd },
    endDate: { $gte: monthStart },
  }).select('startDate endDate');
  const trips = driver.vehicle
    ? await Trip.find({
      customer: customerId,
      vehicle: driver.vehicle,
      ...getClosedTripsMonthFilter(monthStart, monthEnd),
    })
      .select(
        'loadingLocation loadingDate unloadingLocation unloadingDate fillingOrderLocation turnDate closedAt status ' +
        'dieselEntries.filledAt dieselEntries.amount dieselEntries.volumeLitres settlement.balance settlement.totalKm ' +
        'driverAdvances loadingExpense unloadingExpense rtoEntries otherExpenses manualKm manualKmDivert manualKmReturn ' +
        'isDiverted divertUnloadingLocation divertDate'
      )
      .sort('-loadingDate -closedAt')
    : [];
  const monthTrips = trips.filter((trip) => isTripInSalaryMonth(trip, monthStart, monthEnd));
  const routeKmTable = loadRouteKmTable();
  const tripsWithBalances = monthTrips.map((trip) => {
    const corporationKmDetails = getCorporationKmDetails(trip, routeKmTable);
    return {
      ...trip.toObject(),
      balance: trip.settlement?.balance != null ? Number(trip.settlement.balance) : calculateTripBalance(trip),
      corpKm: findRouteKm(routeKmTable, trip.loadingLocation, trip.unloadingLocation),
      corporationKm: corporationKmDetails.value || 0,
      corporationKmSource: corporationKmDetails.source,
      advanceTotal: (trip.driverAdvances || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      dieselTotal: (trip.dieselEntries || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
      dieselLitres: (trip.dieselEntries || []).reduce((sum, entry) => sum + Number(entry.volumeLitres || 0), 0),
      expenseTotal: calculateTripExpense(trip),
    };
  });
  const corporationKm = sumRouteTableKm(tripsWithBalances, routeKmTable, Number(driver.minKmCharges || 0) > 0);
  const manualKmTotal = 0;
  const totalDriverKm = corporationKm + manualKmTotal;
  const { specialTripCount, specialTripCharges } = calculateSpecialTripCharges(tripsWithBalances, routeKmTable);
  const totalBalance = sumTripBalances(tripsWithBalances);
  const totalAdvance = round0(sumTripAdvances(tripsWithBalances));
  const totalDiesel = round0(sumTripDiesel(tripsWithBalances));
  const totalDieselLitres = round0(sumTripDieselLitres(tripsWithBalances));
  const totalExpense = round0(sumTripExpenses(tripsWithBalances));
  const basicSalaryDetails = calculateBasicSalary(
    month,
    driver.basicSalary,
    driver.joiningDate,
    driver.resigningDate,
    leaves
  );
  const basicSalary = basicSalaryDetails.basicSalary;
  const kmCharges = Number(driver.kmCharges || 0);
  const kmBeta = round0(kmCharges * totalDriverKm);
  return {
    month,
    driver,
    trips: tripsWithBalances,
    closedTrips: tripsWithBalances.length,
    totalBalance: round0(totalBalance),
    totalAdvance,
    totalDiesel,
    totalDieselLitres,
    totalExpense,
    basicSalary,
    ...basicSalaryDetails,
    kmCharges,
    corporationKm: round0(corporationKm),
    manualKmTotal: round0(manualKmTotal),
    totalDriverKm: round0(totalDriverKm),
    kmBeta,
    specialTripCount,
    specialTripCharges: round0(specialTripCharges),
    salaryBalance: round0(basicSalary + kmBeta + specialTripCharges - totalBalance),
  };
}

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
      driverName: driver?.name || null,
      driverMobile: driver?.mobileNumber || null,
    };
  });

  res.json({
    customer,
    vehicles: vehicleDetails,
    users: safeUsers,
  });
}

// GET /api/v1/customers/:customerId/users/:userId/salary?month=YYYY-MM
async function getDriverMonthlySalary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }

  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  const { driver, ...response } = summary;
  res.json(response);
}

// GET /api/v1/customers/:customerId/users/:userId/monthly-summary?month=YYYY-MM
async function downloadDriverMonthlySummary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return res.status(400).json({ error: 'month must use YYYY-MM format' });
  }
  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  const [vehicle, customer] = await Promise.all([
    summary.driver.vehicle ? Vehicle.findById(summary.driver.vehicle).select('vehicleNumber') : null,
    Customer.findById(customerId).select('companyName'),
  ]);
  const pdfBuffer = await buildDriverMonthlySummaryPdf({
    driver: summary.driver,
    vehicle,
    customer,
    summary,
    trips: summary.trips,
  });
  const cleanFilenamePart = (value) => String(value || 'Unknown').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  const monthlyFilename = [
    cleanFilenamePart(customer?.companyName),
    cleanFilenamePart(summary.driver?.name || summary.driver?.username),
    cleanFilenamePart(formatMonth(month)),
  ].join('_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${monthlyFilename}.pdf"`);
  res.send(pdfBuffer);
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

// POST /api/v1/customers/:customerId/users  (customer_admin creates a vehicle_user)
// body: { username, password, name, mobileNumber, joiningDate, resigningDate, vehicleId, basicSalary, kmCharges, minKmCharges }
async function createVehicleUser(req, res) {
  const { customerId } = req.params;
  const { username, password, name, mobileNumber, joiningDate, resigningDate, vehicleId, basicSalary, kmCharges, minKmCharges } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required' });
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
  const { name, mobileNumber, joiningDate, resigningDate, username, password, vehicleId, basicSalary, kmCharges, minKmCharges } = req.body;

  const user = await User.findOne({ _id: userId, customer: customerId, role: ROLES.VEHICLE_USER });
  if (!user) return res.status(404).json({ error: 'Driver user not found' });

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

// DELETE /api/v1/customers/:customerId/users/:userId  (archive vehicle_user)
async function deleteVehicleUser(req, res) {
  const { customerId, userId } = req.params;

  const user = await User.findOne({ _id: userId, customer: customerId, role: ROLES.VEHICLE_USER });
  if (!user) return res.status(404).json({ error: 'Driver user not found' });

  user.isActive = false;
  user.resigningDate = user.resigningDate || new Date();
  await user.save();
  res.json({ message: 'Driver archived successfully', userId });
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

  const result = await User.updateMany(
    { _id: { $in: userIds }, customer: customerId, role: ROLES.VEHICLE_USER },
    { $set: { isActive: false, resigningDate: new Date() } }
  );
  res.json({ archivedCount: result.modifiedCount });
}

module.exports = {
  calculateTripBalance,
  calculateTripExpense,
  sumTripBalances,
  sumTripAdvances,
  sumTripDiesel,
  sumTripDieselLitres,
  sumTripExpenses,
  getSalaryMonthBounds,
  getClosedTripsMonthFilter,
  getTripClosedDate,
  isTripInSalaryMonth,
  loadRouteKmTable,
  getTripCorporationKm,
  sumRouteTableKm,
  calculateSpecialTripCharges,
  calculateBasicSalary,
  calculateDriverMonthlySalary,
  createCustomer,
  listCustomers,
  getCustomer,
  getDriverMonthlySalary,
  downloadDriverMonthlySummary,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
  addVehicle,
  createVehicleUser,
  updateVehicleUser,
  deleteVehicleUser,
  bulkUpdateVehicleUsers,
  bulkDeleteVehicleUsers,
};
