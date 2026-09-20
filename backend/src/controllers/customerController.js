const Customer = require('../models/Customer');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Trip = require('../models/Trip');
const fs = require('fs');
const path = require('path');
const { ROLES } = require('../config/constants');
const { buildDriverMonthlySummaryPdf, formatMonth } = require('../utils/pdfGenerator');
const { signPdfToken } = require('../middleware/auth');
const Leave = require('../models/Leave');
const { findRouteKm, getCorporationKmDetails } = require('../utils/corporationKm');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round0(value) {
  return Math.round(Number(value || 0));
}

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
  // Mirrors the trip print: Cleaner Loading + Turn + Parking + Unloading + RTO + Other.
  return Number(trip.loadingExpense || 0) + Number(trip.turnExpense || 0) + Number(trip.parkingExpense || 0)
    + Number(trip.unloadingExpense || 0) + rtoExpense + otherExpense;
}

function calculateTripBalance(trip) {
  const totalAdvance = (trip.driverAdvances || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const totalExpense = calculateTripExpense(trip);
  return Math.round((totalAdvance - totalExpense + Number.EPSILON) * 100) / 100;
}

// Turns a raw trip (mongoose doc or plain object) into the summary row shape used by the salary
// table. Balance is always Trip Advance - Trip Expenses from the entries this row carries - the
// settlement.balance stored at close time is ignored since it can lag behind later edits and
// wouldn't be correct for a row split between a driver and a temporary driver.
function buildTripRow(trip, routeKmTable) {
  const corporationKmDetails = getCorporationKmDetails(trip, routeKmTable);
  return {
    ...trip,
    balance: calculateTripBalance(trip),
    corpKm: findRouteKm(routeKmTable, trip.loadingLocation, trip.unloadingLocation),
    corporationKm: corporationKmDetails.value || 0,
    corporationKmSource: corporationKmDetails.source,
    advanceTotal: (trip.driverAdvances || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    dieselTotal: (trip.dieselEntries || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    dieselLitres: (trip.dieselEntries || []).reduce((sum, entry) => sum + Number(entry.volumeLitres || 0), 0),
    expenseTotal: calculateTripExpense(trip),
  };
}

// True when `date` falls on/after joiningDate and (if set) on/before returningDate.
function isDateInTempWindow(date, joiningDate, returningDate) {
  if (!date) return false;
  const value = new Date(date);
  if (joiningDate && value < joiningDate) return false;
  if (returningDate && value > returningDate) return false;
  return true;
}

// Splits one trip's individually-dated entries (advances/diesel/RTO/other-expense), plus its
// loading- and unloading-linked fixed expenses, between the regular driver and a temporary driver
// based on each entry's own date relative to the temp driver's joining/returning window - so a
// single trip (e.g. loaded before the driver went on leave, closed after the temp driver took
// over) can contribute money to both sides without double-counting either one.
function splitTripEntriesByDate(trip, joiningDate, returningDate) {
  const inTemp = (date) => isDateInTempWindow(date, joiningDate, returningDate);
  const splitArray = (arr, dateField) => ({
    temp: arr.filter((entry) => inTemp(entry[dateField])),
    driver: arr.filter((entry) => !inTemp(entry[dateField])),
  });

  const advances = splitArray(trip.driverAdvances || [], 'date');
  const diesel = splitArray(trip.dieselEntries || [], 'filledAt');
  const rto = splitArray(trip.rtoEntries || [], 'date');
  const other = splitArray(trip.otherExpenses || [], 'date');
  const loadingInTemp = inTemp(trip.loadingDate);
  const unloadingInTemp = inTemp(trip.unloadingDate);

  function buildVariant(useTemp) {
    return {
      ...trip,
      driverAdvances: useTemp ? advances.temp : advances.driver,
      dieselEntries: useTemp ? diesel.temp : diesel.driver,
      rtoEntries: useTemp ? rto.temp : rto.driver,
      otherExpenses: useTemp ? other.temp : other.driver,
      loadingExpense: loadingInTemp === useTemp ? Number(trip.loadingExpense || 0) : 0,
      turnExpense: loadingInTemp === useTemp ? Number(trip.turnExpense || 0) : 0,
      parkingExpense: loadingInTemp === useTemp ? Number(trip.parkingExpense || 0) : 0,
      unloadingExpense: unloadingInTemp === useTemp ? Number(trip.unloadingExpense || 0) : 0,
    };
  }

  return { driverTrip: buildVariant(false), tempTrip: buildVariant(true) };
}

function sumTripBalances(trips) {
  const total = trips.reduce((sum, trip) => {
    const value = trip.balance != null
      ? Number(trip.balance)
      : (trip.settlement?.balance != null ? Number(trip.settlement.balance) : calculateTripBalance(trip));
    return sum + value;
  }, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

function hasTripMoney(trip) {
  return sumTripAdvances([trip]) > 0 || sumTripDiesel([trip]) > 0 || sumTripExpenses([trip]) > 0;
}

// Names of everyone who worked on this trip in the salary month - the regular driver, the
// temporary driver, or both when a trip's entries straddle the temp driver's window.
function getTripDriverNames(trip, driver, temporaryDriver, joiningDate, returningDate) {
  const regularName = driver.name || driver.username || '-';
  if (!temporaryDriver) return [regularName];
  const kmBelongsToTemp = isDateInTempWindow(getTripClosedDate(trip), joiningDate, returningDate);
  const { driverTrip, tempTrip } = splitTripEntriesByDate(trip, joiningDate, returningDate);
  const names = [];
  if (!kmBelongsToTemp || hasTripMoney(driverTrip)) names.push(regularName);
  if (kmBelongsToTemp || hasTripMoney(tempTrip)) names.push(`${temporaryDriver.name} (Temporary)`);
  return names;
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

// A month's salary is calculable from the 5th of the FOLLOWING month - trips that straddle the
// month boundary close in the first days of the next month, so the grace period gives every
// advance/expense a chance to be entered before settlement.
const SALARY_AVAILABLE_DAY = 5;

function getSalaryMonthAvailability(month, today = new Date()) {
  const [year, monthNumber] = month.split('-').map(Number);
  const availableFrom = new Date(year, monthNumber, SALARY_AVAILABLE_DAY);
  return { available: today >= availableFrom, availableFrom };
}

function getLatestCalculableSalaryMonth(today = new Date()) {
  const monthsBack = today.getDate() >= SALARY_AVAILABLE_DAY ? 1 : 2;
  const latest = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
  return `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}`;
}

// Shared month validation for the salary endpoints - returns an error message or null.
function validateSalaryMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'month must use YYYY-MM format';
  const { available, availableFrom } = getSalaryMonthAvailability(month);
  if (!available) {
    return `Salary for ${formatMonth(month)} can be calculated only from ${availableFrom.toLocaleDateString('en-IN')} (${SALARY_AVAILABLE_DAY}th of the following month)`;
  }
  return null;
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
    // No endDate yet means the leave is still ongoing - treat it as open through the payable period.
    const leaveEnd = leave.endDate ? getCalendarDay(new Date(leave.endDate)) : payableEnd;
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

// Substitute-driver coverage entered directly on the driver record (while they're on leave).
// Money (advances/diesel/RTO/other-expense/fixed expenses) is split per entry by its own date
// against joiningDate/returningDate - even entries within the same trip can land on either side.
// KM/mileage stays whole per trip, attributed to whichever driver actually closed it, since a
// single continuous drive can't meaningfully be split in two.
function calculateTemporaryDriverSegment(month, temporaryDriver, monthTrips, routeKmTable, driver) {
  if (!temporaryDriver?.required || !temporaryDriver?.joiningDate) return null;

  const { start: monthStart, end: monthEndExclusive } = getSalaryMonthBounds(month);
  const monthEnd = new Date(monthEndExclusive.getTime() - MS_PER_DAY);
  const daysInMonth = monthEnd.getDate();
  const joiningDate = new Date(temporaryDriver.joiningDate);
  const returningDate = temporaryDriver.returningDate ? new Date(temporaryDriver.returningDate) : null;

  const joiningDay = getCalendarDay(joiningDate);
  // Returning date isn't set yet while the substitute is still covering the vehicle - treat the
  // assignment as ongoing through the end of the salary month until it's filled in.
  const returningDay = returningDate ? getCalendarDay(returningDate) : monthEnd;
  const periodStart = joiningDay > monthStart ? joiningDay : monthStart;
  const periodEnd = returningDay < monthEnd ? returningDay : monthEnd;
  const days = periodEnd >= periodStart ? Math.floor((periodEnd - periodStart) / MS_PER_DAY) + 1 : 0;

  const tempRows = [];
  monthTrips.forEach((tripDoc) => {
    const trip = tripDoc.toObject();
    const closedDate = getTripClosedDate(trip);
    const kmBelongsToTemp = isDateInTempWindow(closedDate, joiningDate, returningDate);

    const { tempTrip } = splitTripEntriesByDate(trip, joiningDate, returningDate);
    const tempRow = buildTripRow(tempTrip, routeKmTable);
    if (!kmBelongsToTemp) {
      tempRow.corporationKm = 0;
      tempRow.corpKm = null;
    }

    const hasTempMoney = tempRow.advanceTotal > 0 || tempRow.dieselTotal > 0 || tempRow.expenseTotal > 0;
    if (hasTempMoney || kmBelongsToTemp) tempRows.push(tempRow);
  });

  const tempKmRows = monthTrips
    .map((tripDoc) => tripDoc.toObject())
    .filter((trip) => isDateInTempWindow(getTripClosedDate(trip), joiningDate, returningDate));
  const corporationKm = sumRouteTableKm(tempKmRows, routeKmTable, Number(driver.minKmCharges || 0) > 0);
  const kmCharges = Number(driver.kmCharges || 0);
  const kmBeta = round0(kmCharges * corporationKm);
  const { specialTripCount, specialTripCharges } = calculateSpecialTripCharges(tempKmRows, routeKmTable);

  const totalAdvance = round0(sumTripAdvances(tempRows));
  const totalDiesel = round0(sumTripDiesel(tempRows));
  const totalDieselLitres = round0(sumTripDieselLitres(tempRows));
  const totalExpense = round0(sumTripExpenses(tempRows));
  const totalBalance = sumTripBalances(tempRows);
  const basicSalary = days > 0 ? round0((Number(driver.basicSalary || 0) / daysInMonth) * days) : 0;

  return {
    name: temporaryDriver.name,
    joiningDate: temporaryDriver.joiningDate,
    returningDate: temporaryDriver.returningDate,
    days,
    basicSalary,
    trips: tempRows,
    tripsCount: tempRows.length,
    closedTrips: tempRows.length,
    corporationKm: round0(corporationKm),
    kmCharges,
    kmBeta,
    specialTripCount,
    specialTripCharges: round0(specialTripCharges),
    totalAdvance,
    totalDiesel,
    totalDieselLitres,
    totalExpense,
    totalBalance: round0(totalBalance),
    salaryBalance: round0(basicSalary + kmBeta + specialTripCharges - totalBalance),
  };
}

async function calculateDriverMonthlySalary(customerId, userId, month) {
  const driver = await User.findOne({
    _id: userId,
    customer: customerId,
    role: ROLES.VEHICLE_USER,
  }).select('name username basicSalary kmCharges minKmCharges joiningDate resigningDate vehicle temporaryDriver');
  if (!driver) return null;

  const { start: monthStart, end: monthEnd } = getSalaryMonthBounds(month);
  const leaves = await Leave.find({
    customer: customerId,
    driver: userId,
    startDate: { $lt: monthEnd },
    $or: [{ endDate: { $gte: monthStart } }, { endDate: null }],
  }).select('startDate endDate');
  const trips = driver.vehicle
    ? await Trip.find({
      customer: customerId,
      vehicle: driver.vehicle,
      ...getClosedTripsMonthFilter(monthStart, monthEnd),
    })
      .select(
        'loadingLocation loadingDate unloadingLocation unloadingDate fillingOrderLocation turnDate closedAt status ' +
        'dieselEntries.filledAt dieselEntries.amount dieselEntries.volumeLitres dieselEntries.paymentMethod dieselEntries.odometerKm ' +
        'settlement.balance settlement.totalKm settlement.mileageKmPerLitre settlement.totalDieselLitres ' +
        'driverAdvances loadingExpense parkingExpense turnExpense unloadingExpense rtoEntries otherExpenses manualKm manualKmDivert manualKmReturn ' +
        'isDiverted divertUnloadingLocation divertDate'
      )
      .sort('-loadingDate -closedAt')
    : [];
  const monthTrips = trips.filter((trip) => isTripInSalaryMonth(trip, monthStart, monthEnd));
  const routeKmTable = loadRouteKmTable();

  const tempDriverInfo = driver.temporaryDriver?.required && driver.temporaryDriver?.joiningDate
    ? driver.temporaryDriver
    : null;
  const joiningDate = tempDriverInfo ? new Date(tempDriverInfo.joiningDate) : null;
  const returningDate = tempDriverInfo?.returningDate ? new Date(tempDriverInfo.returningDate) : null;

  // Money is split per entry by date whenever a temporary driver is on record for this vehicle;
  // KM/mileage is attributed whole-trip, to whichever driver actually closed that trip.
  const tripsWithBalances = monthTrips.map((tripDoc) => {
    const trip = tripDoc.toObject();
    if (!tempDriverInfo) return buildTripRow(trip, routeKmTable);

    const closedDate = getTripClosedDate(trip);
    const kmBelongsToTemp = isDateInTempWindow(closedDate, joiningDate, returningDate);
    const { driverTrip } = splitTripEntriesByDate(trip, joiningDate, returningDate);
    const row = buildTripRow(driverTrip, routeKmTable);
    if (kmBelongsToTemp) {
      row.corporationKm = 0;
      row.corpKm = null;
    }
    return row;
  });
  const driverKmTrips = tempDriverInfo
    ? monthTrips.map((tripDoc) => tripDoc.toObject()).filter((trip) => !isDateInTempWindow(getTripClosedDate(trip), joiningDate, returningDate))
    : monthTrips.map((tripDoc) => tripDoc.toObject());
  const corporationKm = sumRouteTableKm(driverKmTrips, routeKmTable, Number(driver.minKmCharges || 0) > 0);
  const manualKmTotal = 0;
  const totalDriverKm = corporationKm + manualKmTotal;
  const { specialTripCount, specialTripCharges } = calculateSpecialTripCharges(driverKmTrips, routeKmTable);
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
  const temporaryDriver = calculateTemporaryDriverSegment(month, driver.temporaryDriver, monthTrips, routeKmTable, driver);
  // Unsplit trips for the PDF's single-trip pages: every expense on the trip, tagged with
  // whichever driver(s) worked it.
  const detailTrips = monthTrips.map((tripDoc) => {
    const trip = tripDoc.toObject();
    return {
      ...buildTripRow(trip, routeKmTable),
      driverNames: getTripDriverNames(trip, driver, tempDriverInfo, joiningDate, returningDate),
    };
  });
  return {
    month,
    driver,
    trips: tripsWithBalances,
    detailTrips,
    closedTrips: tripsWithBalances.length,
    totalBalance: round0(totalBalance),
    totalAdvance,
    totalDiesel,
    totalDieselLitres,
    totalExpense,
    basicSalary,
    ...basicSalaryDetails,
    kmCharges,
    temporaryDriver,
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

// GET /api/v1/customers/:customerId/users/:userId/salary?month=YYYY-MM
async function getDriverMonthlySalary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });

  const summary = await calculateDriverMonthlySalary(customerId, userId, month);
  if (!summary) return res.status(404).json({ error: 'Driver not found' });
  const { driver, detailTrips, ...response } = summary;
  res.json(response);
}

// POST /api/v1/customers/:customerId/users/:userId/monthly-summary/token?month=YYYY-MM
// Issues a short-lived token so the browser can open the PDF URL directly in a new tab and
// pick up the Content-Disposition filename (blob URLs always save as a random UUID).
async function createDriverMonthlySummaryToken(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  const token = signPdfToken(req.user, { customerId, userId, month });
  res.json({ token });
}

// GET /api/v1/customers/:customerId/users/:userId/monthly-summary?month=YYYY-MM
async function downloadDriverMonthlySummary(req, res) {
  const { customerId, userId } = req.params;
  const month = req.query.month || getLatestCalculableSalaryMonth();
  const monthError = validateSalaryMonth(month);
  if (monthError) return res.status(400).json({ error: monthError });
  if (req.user.scope && (req.user.customerId !== customerId || req.user.userId !== userId || req.user.month !== month)) {
    return res.status(403).json({ error: 'Token is not valid for this report' });
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
    detailTrips: summary.detailTrips,
  });
  const cleanFilenamePart = (value) => String(value || 'Unknown').trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-');
  const monthlyFilename = [
    cleanFilenamePart(customer?.companyName),
    cleanFilenamePart(summary.driver?.name || summary.driver?.username),
    cleanFilenamePart(formatMonth(month)),
  ].join('-');
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
  calculateTripBalance,
  calculateTripExpense,
  sumTripBalances,
  sumTripAdvances,
  sumTripDiesel,
  sumTripDieselLitres,
  sumTripExpenses,
  getSalaryMonthBounds,
  getSalaryMonthAvailability,
  getLatestCalculableSalaryMonth,
  validateSalaryMonth,
  getClosedTripsMonthFilter,
  getTripClosedDate,
  isTripInSalaryMonth,
  loadRouteKmTable,
  getTripCorporationKm,
  sumRouteTableKm,
  calculateSpecialTripCharges,
  calculateBasicSalary,
  getTripDriverNames,
  calculateDriverMonthlySalary,
  createCustomer,
  listCustomers,
  getCustomer,
  getDriverMonthlySalary,
  createDriverMonthlySummaryToken,
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
