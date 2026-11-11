// Driver monthly salary math: trip balances, KM charges, basic salary proration, temp-driver split.
const User = require('../models/User');
const Trip = require('../models/Trip');
const Leave = require('../models/Leave');
const { ROLES } = require('../config/constants');
const { formatMonth } = require('./pdfGenerator');
const { findRouteKm, getCorporationKmDetails, getTripCorporationKm } = require('./corporationKm');
const settings = require('./settings');
const { isDriverAssignedOn } = require('./driverAssignment');
const { getTripClosedDate, getTripSalaryDate } = require('./tripSalaryDate');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round0(value) {
  return Math.round(Number(value || 0));
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function loadRouteKmTable() {
  const rows = settings.getRouteKmTable();
  return Array.isArray(rows) ? rows : [];
}

function calculateTripExpense(trip) {
  const cashDieselExpense = (trip.dieselEntries || [])
    .filter((entry) => entry.paymentMethod === 'cash')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const rtoExpense = (trip.rtoEntries || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  const otherExpense = (trip.otherExpenses || []).reduce((total, entry) => total + Number(entry.amount || 0), 0);
  // Mirrors the trip print: cash diesel + Cleaner Loading + Turn + Parking + Unloading + RTO + Other.
  return cashDieselExpense + Number(trip.loadingExpense || 0) + Number(trip.turnExpense || 0) + Number(trip.parkingExpense || 0)
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
  const corporationKm = getTripCorporationKm(trip, routeKmTable);
  const corporationKmSource = corporationKmDetails.value != null
    ? corporationKmDetails.source
    : corporationKm != null ? 'settlement_odometer' : corporationKmDetails.source;
  return {
    ...trip,
    balance: calculateTripBalance(trip),
    corpKm: findRouteKm(routeKmTable, trip.loadingLocation, trip.unloadingLocation),
    corporationKm: corporationKm || 0,
    corporationKmSource,
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

function getTripEntriesForDriverAssignment(trip, driver) {
  const closedDate = getTripClosedDate(trip);
  const isAssignedOnEntryDate = (date) => Boolean(date && isDriverAssignedOn(driver, date));
  const isAssignedOrClosedOn = (date) => isAssignedOnEntryDate(date || closedDate);
  const assignedEntries = (entries, dateField) => (entries || [])
    .filter((entry) => isAssignedOrClosedOn(entry[dateField]));
  const loadingAssigned = isAssignedOrClosedOn(trip.loadingDate);
  const unloadingAssigned = isAssignedOrClosedOn(trip.unloadingDate);

  return {
    ...trip,
    driverAdvances: assignedEntries(trip.driverAdvances, 'date'),
    dieselEntries: assignedEntries(trip.dieselEntries, 'filledAt'),
    rtoEntries: assignedEntries(trip.rtoEntries, 'date'),
    otherExpenses: assignedEntries(trip.otherExpenses, 'date'),
    loadingExpense: loadingAssigned ? Number(trip.loadingExpense || 0) : 0,
    turnExpense: loadingAssigned ? Number(trip.turnExpense || 0) : 0,
    parkingExpense: loadingAssigned ? Number(trip.parkingExpense || 0) : 0,
    unloadingExpense: unloadingAssigned ? Number(trip.unloadingExpense || 0) : 0,
  };
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

// Each KM leg belongs to whoever was assigned when that leg was completed. When leg details
// are unavailable, fall back to the trip's close date.
function getKmShareForDatePredicate(trip, routeKmTable, isAssignedOnDate) {
  const details = getCorporationKmDetails(trip, routeKmTable);
  const totalKm = getTripCorporationKm(trip, routeKmTable);
  if (!(totalKm > 0)) return 0;

  const tripClosedDate = getTripClosedDate(trip);
  if (!details.legs?.length) {
    const fallbackDate = getTripSalaryDate(trip) || tripClosedDate;
    return fallbackDate && isAssignedOnDate(fallbackDate) ? 1 : 0;
  }

  const assignedKm = details.legs
    .filter((leg) => isAssignedOnDate(leg.date || tripClosedDate))
    .reduce((sum, leg) => sum + leg.km, 0);
  return Math.min(1, assignedKm / totalKm);
}

function getDateWindowShare(trip, joiningDate, returningDate, routeKmTable = []) {
  if (!joiningDate) return 0;
  const joiningDay = getCalendarDay(new Date(joiningDate));
  const returningDay = returningDate ? getCalendarDay(new Date(returningDate)) : null;
  return getKmShareForDatePredicate(trip, routeKmTable, (date) => {
    if (!date) return false;
    const day = getCalendarDay(new Date(date));
    return !Number.isNaN(day.getTime()) && day >= joiningDay && (!returningDay || day <= returningDay);
  });
}

function getTempKmShare(trip, joiningDate, returningDate, routeKmTable = []) {
  const { value } = getCorporationKmDetails(trip, routeKmTable);
  if (!(value > 0)) {
    const closedDate = getTripClosedDate(trip);
    if (!joiningDate || !closedDate) return 0;
    const joiningDay = getCalendarDay(new Date(joiningDate));
    const returningDay = returningDate ? getCalendarDay(new Date(returningDate)) : null;
    const closedDay = getCalendarDay(new Date(closedDate));
    return closedDay >= joiningDay && (!returningDay || closedDay <= returningDay) ? 1 : 0;
  }
  return getDateWindowShare(trip, joiningDate, returningDate, routeKmTable);
}

function getDriverKmShare(trip, driver, routeKmTable = []) {
  return getKmShareForDatePredicate(
    trip,
    routeKmTable,
    (date) => Boolean(date && isDriverAssignedOn(driver, date))
  );
}

function getDriverTempKmShare(trip, driver, joiningDate, returningDate, routeKmTable = []) {
  if (!joiningDate) return 0;
  const joiningDay = getCalendarDay(new Date(joiningDate));
  const returningDay = returningDate ? getCalendarDay(new Date(returningDate)) : null;
  return getKmShareForDatePredicate(trip, routeKmTable, (date) => {
    if (!date) return false;
    const day = getCalendarDay(new Date(date));
    return !Number.isNaN(day.getTime())
      && day >= joiningDay
      && (!returningDay || day <= returningDay)
      && isDriverAssignedOn(driver, date);
  });
}

// Names of everyone who worked on this trip in the salary month - the regular driver, the
// temporary driver, or both when a trip's entries straddle the temp driver's window.
function getTripDriverNames(trip, driver, temporaryDriver, joiningDate, returningDate, routeKmTable = []) {
  const regularName = driver.name || driver.username || '-';
  if (!temporaryDriver) return [regularName];
  const tempShare = getTempKmShare(trip, joiningDate, returningDate, routeKmTable);
  const { driverTrip, tempTrip } = splitTripEntriesByDate(trip, joiningDate, returningDate);
  const names = [];
  if (tempShare < 1 || hasTripMoney(driverTrip)) names.push(regularName);
  if (tempShare > 0 || hasTripMoney(tempTrip)) names.push(`${temporaryDriver.name} (Temporary)`);
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
// month boundary close during the first days of the next month, so the grace period gives every
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
function validateSalaryMonth(month, today = new Date()) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'month must use YYYY-MM format';
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month === currentMonth) return null;
  const { available, availableFrom } = getSalaryMonthAvailability(month, today);
  if (!available) {
    return `Salary for ${formatMonth(month)} can be calculated only from ${availableFrom.toLocaleDateString('en-IN')} (5th of the following month)`;
  }
  return null;
}

function getClosedTripsMonthFilter(monthStart, monthEnd) {
  // Include open trips here because a completed Load Turn can make them salary-ready; readiness
  // filtering below excludes other open trips while retaining close-requested trips.
  return { status: { $in: ['open', 'pending_close', 'closed'] } };
}

function isTripInSalaryMonth(trip, monthStart, monthEnd) {
  const salaryDate = getTripSalaryDate(trip);
  return salaryDate && salaryDate >= monthStart && salaryDate < monthEnd;
}

function hasCompletedLoadTurn(trip) {
  if (!trip?.turnDate) return false;
  return !Number.isNaN(new Date(trip.turnDate).getTime());
}

function isSalaryTripReady(trip) {
  return ['pending_close', 'closed'].includes(trip?.status) || hasCompletedLoadTurn(trip);
}

// `shareOf(trip)` returns the 0..1 fraction of that trip's KM owed to the driver being summed -
// 1 for every trip when no temporary driver is involved.
function sumRouteTableKm(trips, routeKmTable, excludeShortTrips = false, shareOf = () => 1) {
  return trips.reduce((total, trip) => {
    const routeKm = getTripCorporationKm(trip, routeKmTable);
    if (!Number.isFinite(routeKm) || (excludeShortTrips && routeKm < 200)) return total;
    return total + routeKm * shareOf(trip);
  }, 0);
}

// Apply the driver's configured Less than 200 KM charge only to routes under 200 KM.
// With a temporary driver the charge is split by date using the same share as the KM.
function calculateSpecialTripCharges(trips, routeKmTable, lessThan200Charge = 0, shareOf = () => 1) {
  let shortTripCount = 0;
  let specialTripCharges = 0;
  trips.forEach((trip) => {
    const route = routeKmTable.find((row) => (
      String(row.loadingLocation || '').trim() === String(trip.loadingLocation || '').trim() &&
      String(row.unloadingLocation || '').trim() === String(trip.unloadingLocation || '').trim()
    ));
    if (!route || !(Number(route.km) < 200)) return;
    const share = shareOf(trip);
    if (share <= 0) return;
    shortTripCount += 1;
    specialTripCharges += Number(lessThan200Charge || 0) * share;
  });
  return {
    specialTripCount: shortTripCount,
    specialTripCharges: round0(specialTripCharges),
  };
}

function getCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calculateBasicSalary(month, monthlyBasicSalary, joiningDate, resigningDate, leaves = [], asOfDate = null) {
  const { start: monthStart, end: monthEndExclusive } = getSalaryMonthBounds(month);
  const monthLastDay = new Date(monthEndExclusive.getTime() - MS_PER_DAY);
  const asOfDay = asOfDate ? getCalendarDay(asOfDate) : monthLastDay;
  const monthEnd = asOfDay < monthLastDay ? asOfDay : monthLastDay;
  const daysInMonth = monthLastDay.getDate();
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

// A row with no KM and no money (advance/diesel/expense) carries nothing for that person.
function hasRowDetails(row) {
  return row.corporationKm > 0 || hasTripMoney(row);
}

// Substitute-driver coverage entered directly on the driver record (while they're on leave).
// Money (advances/diesel/RTO/other-expense/fixed expenses) is split per entry by its own date
// against joiningDate/returningDate - even entries within the same trip can land on either side.
// KM (and the <200 KM special charge) is split leg by leg by the date each leg was completed -
// see getTempKmShare.
function calculateTemporaryDriverSegment(month, temporaryDriver, monthTrips, routeKmTable, driver, asOfDate = null, temporaryKmShareOf = () => 0, previousTripTurnDates = new Map()) {
  if (!temporaryDriver?.required || !temporaryDriver?.joiningDate) return null;

  const { start: monthStart, end: monthEndExclusive } = getSalaryMonthBounds(month);
  const monthLastDay = new Date(monthEndExclusive.getTime() - MS_PER_DAY);
  const asOfDay = asOfDate ? getCalendarDay(asOfDate) : monthLastDay;
  const monthEnd = asOfDay < monthLastDay ? asOfDay : monthLastDay;
  const daysInMonth = monthLastDay.getDate();
  const joiningDate = new Date(temporaryDriver.joiningDate);
  const returningDate = temporaryDriver.returningDate ? new Date(temporaryDriver.returningDate) : null;

  const joiningDay = getCalendarDay(joiningDate);
  // Returning date isn't set yet while the substitute is still covering the vehicle - treat the
  // assignment as ongoing through the end of the salary month until it's filled in.
  const returningDay = returningDate ? getCalendarDay(returningDate) : monthEnd;
  const periodStart = joiningDay > monthStart ? joiningDay : monthStart;
  const periodEnd = returningDay < monthEnd ? returningDay : monthEnd;
  const days = periodEnd >= periodStart ? Math.floor((periodEnd - periodStart) / MS_PER_DAY) + 1 : 0;

  const tempShareOf = temporaryKmShareOf;
  const tempRows = [];
  monthTrips.forEach((tripDoc) => {
    const trip = tripDoc.toObject();
    const tempShare = tempShareOf(trip);

    const assignedTrip = getTripEntriesForDriverAssignment(trip, driver);
    const { tempTrip } = splitTripEntriesByDate(assignedTrip, joiningDate, returningDate);
    const tempRow = buildTripRow(tempTrip, routeKmTable);
    tempRow.previousTripTurnDate = previousTripTurnDates.get(String(trip._id)) || null;
    tempRow.corporationKm = round2(tempRow.corporationKm * tempShare);
    if (tempShare <= 0) tempRow.corpKm = null;

    if (hasRowDetails(tempRow)) tempRows.push(tempRow);
  });

  const allTrips = monthTrips.map((tripDoc) => tripDoc.toObject());
  const corporationKm = sumRouteTableKm(allTrips, routeKmTable, Number(driver.minKmCharges || 0) > 0, tempShareOf);
  const kmCharges = Number(driver.kmCharges || 0);
  const kmBeta = round0(kmCharges * corporationKm);
  const { specialTripCount, specialTripCharges } = calculateSpecialTripCharges(allTrips, routeKmTable, driver.minKmCharges, tempShareOf);

  // Months entirely outside the substitute's window have nothing to pay - no temporary sheet.
  if (days === 0 && tempRows.length === 0) return null;

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
    specialTripRate: Number(driver.minKmCharges || 0),
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
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const asOfDate = month === currentMonth ? today : null;
  const driver = await User.findOne({
    _id: userId,
    customer: customerId,
    role: ROLES.VEHICLE_USER,
  }).select('name username basicSalary kmCharges minKmCharges joiningDate resigningDate vehicle temporaryDriver');
  if (!driver) return null;

  const { start: monthStart, end: monthEnd } = getSalaryMonthBounds(month);
  const monthEndExclusive = asOfDate
    ? new Date(Math.min(monthEnd.getTime(), getCalendarDay(asOfDate).getTime() + MS_PER_DAY))
    : monthEnd;
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
        'loadingLocation loadingDate unloadingLocation unloadingDate fillingOrderLocation turnDate unTurnDate closedAt status ' +
        'dieselEntries.filledAt dieselEntries.amount dieselEntries.volumeLitres dieselEntries.paymentMethod dieselEntries.odometerKm dieselEntries.loadingPointTankFill ' +
        'settlement.balance settlement.totalKm settlement.mileageKmPerLitre settlement.totalDieselLitres ' +
        'driverAdvances loadingExpense parkingExpense turnExpense unloadingExpense rtoEntries otherExpenses manualKm manualKmDivert manualKmReturn ' +
        'isDiverted divertUnloadingLocation divertDate'
      )
      .sort('-loadingDate -closedAt')
    : [];
  const routeKmTable = loadRouteKmTable();
  // A vehicle can carry several drivers over time (one per date range) - only trips that fall
  // inside this driver's own joining/resigning window belong on their sheet. A trip that crosses
  // an assignment boundary also belongs to each driver who completed a KM leg during their window.
  const monthTrips = trips.filter((trip) => (
    isSalaryTripReady(trip)
    && isTripInSalaryMonth(trip, monthStart, monthEndExclusive)
    && (
      isDriverAssignedOn(driver, getTripSalaryDate(trip))
      || getDriverKmShare(trip, driver, routeKmTable) > 0
      || hasTripMoney(getTripEntriesForDriverAssignment(trip, driver))
    )
  ));
  const previousTrips = monthTrips.length > 0
    ? await Trip.find({
      customer: customerId,
      vehicle: driver.vehicle,
      nextTrip: { $in: monthTrips.map((trip) => trip._id) },
    }).sort({ createdAt: -1 }).select('nextTrip turnDate createdAt')
    : [];
  const previousTripTurnDates = new Map();
  previousTrips.forEach((trip) => {
    const nextTripId = String(trip.nextTrip);
    if (!previousTripTurnDates.has(nextTripId)) {
      previousTripTurnDates.set(nextTripId, trip.turnDate || null);
    }
  });

  const tempDriverInfo = driver.temporaryDriver?.required && driver.temporaryDriver?.joiningDate
    ? driver.temporaryDriver
    : null;
  const joiningDate = tempDriverInfo ? new Date(tempDriverInfo.joiningDate) : null;
  const returningDate = tempDriverInfo?.returningDate ? new Date(tempDriverInfo.returningDate) : null;

  // KM is attributed to the assigned driver when each leg is completed. Advances and expenses
  // are attributed by their own dates within that driver's assignment window.
  const assignmentKmShareOf = (trip) => getDriverKmShare(trip, driver, routeKmTable);
  const tempKmShareOf = (trip) => tempDriverInfo
    ? getDriverTempKmShare(trip, driver, joiningDate, returningDate, routeKmTable)
    : 0;
  const driverShareOf = (trip) => assignmentKmShareOf(trip) - tempKmShareOf(trip);
  const tripsWithBalances = monthTrips.map((tripDoc) => {
    const trip = tripDoc.toObject();
    const assignedTrip = getTripEntriesForDriverAssignment(trip, driver);
    const rowTrip = tempDriverInfo
      ? splitTripEntriesByDate(assignedTrip, joiningDate, returningDate).driverTrip
      : assignedTrip;
    const row = buildTripRow(rowTrip, routeKmTable);
    row.previousTripTurnDate = previousTripTurnDates.get(String(trip._id)) || null;
    const driverShare = driverShareOf(trip);
    row.corporationKm = round2(row.corporationKm * driverShare);
    if (driverShare <= 0) row.corpKm = null;
    return row;
  }).filter(hasRowDetails);
  const allTrips = monthTrips.map((tripDoc) => tripDoc.toObject());
  const corporationKm = sumRouteTableKm(allTrips, routeKmTable, Number(driver.minKmCharges || 0) > 0, driverShareOf);
  const manualKmTotal = 0;
  const totalDriverKm = corporationKm + manualKmTotal;
  const { specialTripCount, specialTripCharges } = calculateSpecialTripCharges(allTrips, routeKmTable, driver.minKmCharges, driverShareOf);
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
    leaves,
    asOfDate
  );
  const basicSalary = basicSalaryDetails.basicSalary;
  const kmCharges = Number(driver.kmCharges || 0);
  const kmBeta = round0(kmCharges * totalDriverKm);
  const temporaryDriver = calculateTemporaryDriverSegment(
    month,
    driver.temporaryDriver,
    monthTrips,
    routeKmTable,
    driver,
    asOfDate,
    tempKmShareOf,
    previousTripTurnDates
  );
  return {
    month,
    isLive: Boolean(asOfDate),
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
    temporaryDriver,
    corporationKm: round0(corporationKm),
    manualKmTotal: round0(manualKmTotal),
    totalDriverKm: round0(totalDriverKm),
    kmBeta,
    specialTripCount,
    specialTripRate: Number(driver.minKmCharges || 0),
    specialTripCharges: round0(specialTripCharges),
    salaryBalance: round0(basicSalary + kmBeta + specialTripCharges - totalBalance),
  };
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
  getTripSalaryDate,
  isTripInSalaryMonth,
  hasCompletedLoadTurn,
  isSalaryTripReady,
  loadRouteKmTable,
  getTripCorporationKm,
  sumRouteTableKm,
  calculateSpecialTripCharges,
  calculateBasicSalary,
  getTempKmShare,
  getDriverKmShare,
  getDriverTempKmShare,
  getTripDriverNames,
  calculateDriverMonthlySalary,
};
