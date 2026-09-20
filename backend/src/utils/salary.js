// Driver monthly salary math: trip balances, KM charges, basic salary proration, temp-driver split.
const User = require('../models/User');
const Trip = require('../models/Trip');
const Leave = require('../models/Leave');
const { ROLES } = require('../config/constants');
const { formatMonth } = require('./pdfGenerator');
const { findRouteKm, getCorporationKmDetails } = require('./corporationKm');
const settings = require('./settings');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round0(value) {
  return Math.round(Number(value || 0));
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
};
