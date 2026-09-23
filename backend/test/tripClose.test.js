const test = require('node:test');
const assert = require('node:assert/strict');

const mongoose = require('mongoose');
const tripController = require('../src/controllers/tripController');
const authController = require('../src/controllers/authController');
const customerController = require('../src/controllers/customerController');
const vehicleController = require('../src/controllers/vehicleController');
const { ROUTE_KM_TABLE, LOADING_LOCATIONS, UNLOADING_LOCATIONS } = require('../src/config/constants');
const User = require('../src/models/User');
const Trip = require('../src/models/Trip');
const metaRoutes = require('../src/routes/metaRoutes');
const { calculateTripKm, computeTripSettlement } = require('../src/utils/tripCalculations');
const { getCorporationKmDetails } = require('../src/utils/corporationKm');

test('tripController exposes a closeTrip endpoint', () => {
  assert.equal(typeof tripController.closeTrip, 'function');
});

test('trip close requires loading and unloading location and date', () => {
  assert.deepEqual(tripController.getMissingTripRouteFields({}), [
    'loading location',
    'loading date',
    'unloading location',
    'unloading date',
  ]);

  assert.deepEqual(tripController.getMissingTripRouteFields({
    loadingLocation: 'MRPL',
    loadingDate: new Date('2026-08-01'),
    unloadingLocation: 'Trichy',
    unloadingDate: new Date('2026-08-03'),
  }), []);

  assert.deepEqual(tripController.getMissingTripRouteFields({
    loadingLocation: '   ',
    loadingDate: new Date('2026-08-01'),
    unloadingLocation: 'Trichy',
  }), ['loading location', 'unloading date']);
});

test('closed trip month uses the closing diesel filled date', () => {
  const closingDate = new Date('2026-08-31T18:30:00.000Z');

  assert.equal(tripController.getClosingDieselDate({ dieselEntries: [{ filledAt: closingDate }] }).getTime(), closingDate.getTime());
  assert.equal(tripController.getClosingDieselDate({ dieselEntries: [] }), null);
});

test('tripController exposes a deleteDieselEntry endpoint', () => {
  assert.equal(typeof tripController.deleteDieselEntry, 'function');
});

test('diesel filling requires valid GPS coordinates', () => {
  assert.equal(tripController.hasValidGpsCoordinates(12.9716, 77.5946), true);
  assert.equal(tripController.hasValidGpsCoordinates(0, 0), true);
  assert.equal(tripController.hasValidGpsCoordinates(undefined, 77.5946), false);
  assert.equal(tripController.hasValidGpsCoordinates(91, 77.5946), false);
});

test('tripController exposes a deleteOtherExpense endpoint', () => {
  assert.equal(typeof tripController.deleteOtherExpense, 'function');
});

test('tripController exposes an updateRtoEntry endpoint', () => {
  assert.equal(typeof tripController.updateRtoEntry, 'function');
});

test('metaRoutes exposes a persisted route km table loader and saver', () => {
  assert.equal(typeof metaRoutes.loadRouteKmTable, 'function');
  assert.equal(typeof metaRoutes.persistRouteKmTable, 'function');
});

test('authController exposes login, refresh, logout and password reset', () => {
  assert.equal(typeof authController.login, 'function');
  assert.equal(typeof authController.refresh, 'function');
  assert.equal(typeof authController.logout, 'function');
  assert.equal(typeof authController.resetUserPassword, 'function');
  assert.equal(typeof authController.changePassword, 'function');
  assert.equal(typeof authController.setRecoveryContact, 'function');
  assert.equal(typeof authController.forgotPassword, 'function');
  assert.equal(typeof authController.resetPasswordWithCode, 'function');
  assert.equal(authController.resetAllAdminPasswords, undefined);
});

test('customerController exposes updateCustomer endpoint', () => {
  assert.equal(typeof customerController.updateCustomer, 'function');
});

test('customerController exposes updateVehicleUser endpoint', () => {
  assert.equal(typeof customerController.updateVehicleUser, 'function');
});

test('basic salary prorates from an employee joining date', () => {
  const salary = customerController.calculateBasicSalary('2026-04', 30000, new Date(2026, 3, 11), null, [
    { startDate: new Date(2026, 3, 15), endDate: new Date(2026, 3, 16) },
  ]);

  assert.equal(salary.daysInMonth, 30);
  assert.equal(salary.payableDays, 18);
  assert.equal(salary.unpaidLeaveDays, 2);
  assert.equal(salary.basicSalary, 18000);
});

test('basic salary prorates through an employee resigning date', () => {
  const salary = customerController.calculateBasicSalary('2026-04', 30000, null, new Date(2026, 3, 10), [
    { startDate: new Date(2026, 3, 5), endDate: new Date(2026, 3, 6) },
  ]);

  assert.equal(salary.payableDays, 8);
  assert.equal(salary.unpaidLeaveDays, 2);
  assert.equal(salary.basicSalary, 8000);
});

test('basic salary deducts unique unpaid leave days for a full month', () => {
  const salary = customerController.calculateBasicSalary('2024-02', 29000, null, null, [
    { startDate: new Date(2024, 1, 5), endDate: new Date(2024, 1, 7) },
    { startDate: new Date(2024, 1, 7), endDate: new Date(2024, 1, 9) },
  ]);

  assert.equal(salary.daysInMonth, 29);
  assert.equal(salary.unpaidLeaveDays, 5);
  assert.equal(salary.payableDays, 24);
  assert.equal(salary.basicSalary, 24000);
});

test('monthly salary calculates balance for closed trips pending settlement', () => {
  const balance = customerController.calculateTripBalance({
    driverAdvances: [{ amount: 2000 }],
    loadingExpense: 150,
    unloadingExpense: 250,
    rtoEntries: [{ amount: 100 }],
    otherExpenses: [{ amount: 300 }],
  });

  assert.equal(balance, 1200);
});

test('monthly salary total is the sum of every closed trip balance', () => {
  const total = customerController.sumTripBalances([
    { settlement: { balance: 1200 } },
    { settlement: { balance: -250 } },
    {
      driverAdvances: [{ amount: 500 }],
      loadingExpense: 50,
      unloadingExpense: 25,
    },
  ]);

  assert.equal(total, 1375);
});

test('monthly salary sums driver advances across every trip in the month', () => {
  const total = customerController.sumTripAdvances([
    { driverAdvances: [{ amount: 20000 }, { amount: 5000 }] },
    { driverAdvances: [{ amount: 2650 }] },
    { driverAdvances: [] },
  ]);

  assert.equal(total, 27650);
});

test('monthly salary sums diesel fills across every trip in the month', () => {
  const total = customerController.sumTripDiesel([
    { dieselEntries: [{ amount: 5000 }, { amount: 3000 }] },
    { dieselEntries: [{ amount: 1500 }] },
    { dieselEntries: [] },
  ]);

  assert.equal(total, 9500);
});

test('monthly salary sums diesel litres across every trip in the month', () => {
  const total = customerController.sumTripDieselLitres([
    { dieselEntries: [{ volumeLitres: 200 }, { volumeLitres: 100 }] },
    { dieselEntries: [{ volumeLitres: 50 }] },
    { dieselEntries: [] },
  ]);

  assert.equal(total, 350);
});

test('trip expense includes cash diesel and trip expenses, but excludes diesel card and driver advance', () => {
  const expense = customerController.calculateTripExpense({
    loadingExpense: 300,
    unloadingExpense: 200,
    rtoEntries: [{ amount: 100 }],
    otherExpenses: [{ amount: 50 }],
    driverAdvances: [{ amount: 99999 }],
    dieselEntries: [{ amount: 99999, paymentMethod: 'diesel_card' }, { amount: 400, paymentMethod: 'cash' }],
  });

  assert.equal(expense, 1050);
});

test('trip expense includes cleaner loading, turn and parking like the trip print', () => {
  const expense = customerController.calculateTripExpense({
    loadingExpense: 300,
    turnExpense: 120,
    parkingExpense: 80,
    rtoEntries: [{ amount: 100 }],
    otherExpenses: [{ amount: 50 }],
  });

  assert.equal(expense, 650);
});

test('salary month is calculable from the 5th of the following month', () => {
  const sep20 = new Date(2026, 8, 20);
  assert.equal(customerController.getSalaryMonthAvailability('2026-07', sep20).available, true);
  assert.equal(customerController.getSalaryMonthAvailability('2026-08', sep20).available, true);
  assert.equal(customerController.getSalaryMonthAvailability('2026-08', new Date(2026, 8, 4)).available, false);
  assert.equal(customerController.getSalaryMonthAvailability('2026-08', new Date(2026, 8, 5)).available, true);
  assert.equal(customerController.getSalaryMonthAvailability('2026-09', sep20).available, false);
  assert.equal(customerController.getSalaryMonthAvailability('2026-12', new Date(2027, 0, 5)).available, true);
  assert.equal(customerController.getSalaryMonthAvailability('2026-12', new Date(2027, 0, 4)).available, false);
  assert.equal(customerController.getLatestCalculableSalaryMonth(sep20), '2026-08');
  assert.equal(customerController.getLatestCalculableSalaryMonth(new Date(2026, 8, 4)), '2026-07');
  assert.equal(customerController.getLatestCalculableSalaryMonth(new Date(2026, 8, 5)), '2026-08');
  assert.equal(customerController.getLatestCalculableSalaryMonth(new Date(2027, 0, 3)), '2026-11');
  assert.equal(customerController.getLatestCalculableSalaryMonth(new Date(2027, 0, 5)), '2026-12');
});

test('single trip pages name the regular driver, the temporary driver, or both when a trip straddles the handover', () => {
  const driver = { name: 'Kumar' };
  const temp = { name: 'Ravi' };
  const joining = new Date('2026-08-15');
  const base = { dieselEntries: [], rtoEntries: [], otherExpenses: [], loadingExpense: 0, unloadingExpense: 0 };

  assert.deepEqual(customerController.getTripDriverNames(
    { ...base, loadingDate: new Date('2026-08-02'), turnDate: new Date('2026-08-05'), driverAdvances: [{ date: new Date('2026-08-02'), amount: 500 }] },
    driver, temp, joining, null
  ), ['Kumar']);

  assert.deepEqual(customerController.getTripDriverNames(
    { ...base, loadingDate: new Date('2026-08-20'), turnDate: new Date('2026-08-22'), driverAdvances: [{ date: new Date('2026-08-20'), amount: 500 }] },
    driver, temp, joining, null
  ), ['Ravi (Temporary)']);

  assert.deepEqual(customerController.getTripDriverNames(
    { ...base, loadingDate: new Date('2026-08-12'), turnDate: new Date('2026-08-17'), driverAdvances: [{ date: new Date('2026-08-12'), amount: 500 }] },
    driver, temp, joining, null
  ), ['Kumar', 'Ravi (Temporary)']);

  assert.deepEqual(customerController.getTripDriverNames(
    { ...base, loadingDate: new Date('2026-08-12'), turnDate: new Date('2026-08-17') },
    driver, null, null, null
  ), ['Kumar']);
});

test('monthly salary sums trip expenses across every trip in the month', () => {
  const total = customerController.sumTripExpenses([
    { loadingExpense: 300, unloadingExpense: 200, rtoEntries: [], otherExpenses: [] },
    { loadingExpense: 0, unloadingExpense: 0, rtoEntries: [{ amount: 150 }], otherExpenses: [{ amount: 50 }] },
  ]);

  assert.equal(total, 700);
});

test('monthly salary assigns trips to their closed month when the trip was closed in August', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-08');
  const filter = customerController.getClosedTripsMonthFilter(start, end);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 7);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 8);
  assert.deepEqual(filter, {
    status: { $in: ['open', 'pending_close', 'closed'] },
  });
});

test('settlement mileage uses Tank Fill opening odometers and diesel from the second fill through next first fill', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 1000, loadingPointTankFill: true, volumeLitres: 10, amount: 100 },
      { volumeLitres: 40, amount: 400 },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [{ odometerKm: 1500, loadingPointTankFill: true, volumeLitres: 20, amount: 200 }],
  });

  assert.equal(result.settlement.totalKm, 500);
  assert.equal(result.settlement.totalDieselLitres, 60);
  assert.equal(result.settlement.mileageKmPerLitre, 8.33);
});

test('settlement groups same-date next-trip fills at the same GPS location up to the Tank Fill', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 1000, loadingPointTankFill: true, volumeLitres: 10, amount: 100 },
      { volumeLitres: 40, amount: 400 },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [
      { filledAt: new Date('2026-08-15'), volumeLitres: 15, amount: 150, gps: { lat: 12.9717, lng: 77.5946 } },
      { odometerKm: 1500, loadingPointTankFill: true, filledAt: new Date('2026-08-15'), volumeLitres: 20, amount: 200, gps: { lat: 12.9716, lng: 77.5946 } },
      { filledAt: new Date('2026-08-15'), volumeLitres: 25, amount: 250, gps: { lat: 12.9716, lng: 77.5946 } },
    ],
  });

  assert.equal(result.settlement.totalDieselLitres, 75);
  assert.equal(result.settlement.totalDieselCost, 750);
  assert.equal(result.settlement.totalKm, 500);
  assert.equal(result.settlement.mileageKmPerLitre, 6.67);
});

test('trip KM is the next trip first Tank Fill odometer minus the current trip first Tank Fill odometer', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 990, loadingPointTankFill: false, volumeLitres: 5, amount: 50 },
      { odometerKm: 1000, loadingPointTankFill: true, volumeLitres: 10, amount: 100 },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [
      { odometerKm: 1490, loadingPointTankFill: false, volumeLitres: 5, amount: 50 },
      { odometerKm: 1500, loadingPointTankFill: true, volumeLitres: 20, amount: 200 },
    ],
  });

  assert.equal(result.settlement.totalKm, 500);
});

test('trip KM falls back to the next trip first fill odometer when it has no Tank Fill entry', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 2600, loadingPointTankFill: true, volumeLitres: 300, amount: 30000 },
      { volumeLitres: 100, amount: 10000 },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [{ odometerKm: 3350, loadingPointTankFill: false, volumeLitres: 90, amount: 9000 }],
  });

  assert.equal(result.settlement.totalKm, 750);
  assert.equal(result.settlement.totalDieselLitres, 190);
  assert.equal(result.settlement.mileageKmPerLitre, 3.95);
});

test('settlement excludes next-trip fills made after the Tank Fill, even at the same pump on the same day', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 1750, loadingPointTankFill: true, volumeLitres: 190, amount: 19000 },
      { volumeLitres: 10, amount: 1000, gps: { lat: 35.5152, lng: 139.5055 } },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [
      { odometerKm: 2600, loadingPointTankFill: true, filledAt: new Date('2026-08-13'), volumeLitres: 300, amount: 30000, gps: { lat: 35.5152, lng: 139.5056 } },
      { filledAt: new Date('2026-08-13'), volumeLitres: 100, amount: 10000, gps: { lat: 35.5152, lng: 139.5056 } },
    ],
  });

  assert.equal(result.settlement.totalKm, 850);
  assert.equal(result.settlement.totalDieselLitres, 310);
  assert.equal(result.settlement.totalDieselCost, 31000);
  assert.equal(result.settlement.mileageKmPerLitre, 2.74);
});

test('settlement uses only the first next-trip fill when GPS is unavailable', () => {
  const result = computeTripSettlement({
    dieselEntries: [
      { odometerKm: 1000, loadingPointTankFill: true, volumeLitres: 10, amount: 100 },
      { volumeLitres: 40, amount: 400 },
    ],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [
      { odometerKm: 1500, loadingPointTankFill: true, filledAt: new Date('2026-08-15'), volumeLitres: 20, amount: 200 },
      { filledAt: new Date('2026-08-15'), volumeLitres: 15, amount: 150 },
    ],
  });

  assert.equal(result.settlement.totalDieselLitres, 60);
  assert.equal(result.settlement.totalDieselCost, 600);
});

test('trip KM falls back to the current trip first fill odometer when it has no Tank Fill entry', () => {
  const result = computeTripSettlement({
    dieselEntries: [{ odometerKm: 3350, loadingPointTankFill: false, volumeLitres: 90, amount: 9000 }],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [{ odometerKm: 4050, loadingPointTankFill: true, volumeLitres: 230, amount: 23000 }],
  });

  assert.equal(result.settlement.totalKm, 700);
  assert.equal(result.settlement.totalDieselLitres, 230);
  assert.equal(result.settlement.mileageKmPerLitre, 3.04);
});

test('salary month uses the final diesel fill when closedAt is missing', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-07');
  const trip = { closedAt: null, dieselEntries: [{ filledAt: new Date('2026-07-24T00:00:00.000Z') }] };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
  assert.equal(customerController.getTripClosedDate(trip).toISOString(), '2026-07-24T00:00:00.000Z');
});

test('still-open trip with no turnDate/diesel/closedAt falls back to loading date for salary month grouping', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-08');
  const trip = { status: 'open', loadingDate: new Date('2026-08-10T00:00:00.000Z'), dieselEntries: [] };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
  assert.equal(customerController.getTripClosedDate(trip).toISOString(), '2026-08-10T00:00:00.000Z');
});

test('final closing diesel date takes precedence over stale closedAt', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-07');
  const trip = {
    closedAt: new Date('2026-08-02T00:00:00.000Z'),
    dieselEntries: [{ filledAt: new Date('2026-07-24T00:00:00.000Z') }],
  };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
});

test('L Turn date takes precedence as the salary close date', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-08');
  const trip = {
    turnDate: new Date('2026-08-31T00:00:00.000Z'),
    closedAt: new Date('2026-09-02T00:00:00.000Z'),
    dieselEntries: [{ filledAt: new Date('2026-09-03T00:00:00.000Z') }],
  };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
  assert.equal(customerController.getTripClosedDate(trip).toISOString(), '2026-08-31T00:00:00.000Z');
});

test('COP KM is the sum of matching route KM table entries for closed trips', () => {
  const total = customerController.sumRouteTableKm([
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', fillingOrderLocation: 'MRPL', settlement: { totalKm: 999 } },
    { loadingLocation: 'AEGIS', unloadingLocation: 'Belgaum', fillingOrderLocation: 'AEGIS', settlement: { totalKm: 1 } },
    { loadingLocation: 'Unknown', unloadingLocation: 'Unknown', settlement: { totalKm: 500 } },
  ], [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 450 },
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 450 },
    { loadingLocation: 'AEGIS', unloadingLocation: 'Belgaum', km: 275.5 },
    { loadingLocation: 'AEGIS', unloadingLocation: 'Belgaum', km: 275.5 },
  ]);

  assert.equal(total, 725.5);
});

test('special trip charges count closed routes below 200 KM at Rs 1000 each', () => {
  const charges = customerController.calculateSpecialTripCharges([
    { loadingLocation: 'Short', unloadingLocation: 'Route' },
    { loadingLocation: 'Long', unloadingLocation: 'Route' },
    { loadingLocation: 'Missing', unloadingLocation: 'Route' },
  ], [
    { loadingLocation: 'Short', unloadingLocation: 'Route', km: 199 },
    { loadingLocation: 'Long', unloadingLocation: 'Route', km: 200 },
  ]);

  assert.deepEqual(charges, { specialTripCount: 1, specialTripCharges: 1000 });
});

test('driver KM and short-trip charges split leg by leg when a temporary driver covers part of a trip', () => {
  const joining = new Date('2026-08-15');
  const returning = new Date('2026-08-20');
  const routeKmTable = [
    { loadingLocation: 'Short', unloadingLocation: 'Route', km: 100 },
    { loadingLocation: 'Route', unloadingLocation: 'Divert', km: 60 },
  ];
  // Unloaded on the 13th by the regular driver, load turn on the 17th by the temp driver ->
  // load leg (50 km) to the driver, return leg (50 km) to the temp.
  const straddling = { loadingLocation: 'Short', unloadingLocation: 'Route', fillingOrderLocation: 'Short', loadingDate: new Date('2026-08-12'), unloadingDate: new Date('2026-08-13'), turnDate: new Date('2026-08-17'), dieselEntries: [] };
  const regularOnly = { loadingLocation: 'Short', unloadingLocation: 'Route', fillingOrderLocation: 'Short', loadingDate: new Date('2026-08-02'), unloadingDate: new Date('2026-08-03'), turnDate: new Date('2026-08-05'), dieselEntries: [] };
  const tempOnly = { loadingLocation: 'Short', unloadingLocation: 'Route', fillingOrderLocation: 'Short', loadingDate: new Date('2026-08-16'), unloadingDate: new Date('2026-08-17'), turnDate: new Date('2026-08-19'), dieselEntries: [] };

  assert.equal(customerController.getTempKmShare(straddling, joining, returning, routeKmTable), 0.5);
  assert.equal(customerController.getTempKmShare(regularOnly, joining, returning, routeKmTable), 0);
  assert.equal(customerController.getTempKmShare(tempOnly, joining, returning, routeKmTable), 1);

  // Diverted trip: load leg (50) on the 14th -> driver; divert leg (30) on the 16th and return
  // leg (Route->Divert reused, 30) on the 18th -> temp. Temp share = 60 / 110.
  const diverted = {
    loadingLocation: 'Short', unloadingLocation: 'Route', fillingOrderLocation: 'Route', isDiverted: true, divertUnloadingLocation: 'Divert',
    loadingDate: new Date('2026-08-13'), unloadingDate: new Date('2026-08-14'), divertDate: new Date('2026-08-16'), turnDate: new Date('2026-08-18'), dieselEntries: [],
  };
  assert.equal(customerController.getTempKmShare(diverted, joining, returning, routeKmTable), 60 / 110);

  const tempShareOf = (trip) => customerController.getTempKmShare(trip, joining, returning, routeKmTable);
  const driverShareOf = (trip) => 1 - tempShareOf(trip);
  const trips = [straddling, regularOnly, tempOnly];

  assert.equal(customerController.sumRouteTableKm(trips, routeKmTable, false, driverShareOf), 150);
  assert.equal(customerController.sumRouteTableKm(trips, routeKmTable, false, tempShareOf), 150);
  assert.deepEqual(customerController.calculateSpecialTripCharges(trips, routeKmTable, driverShareOf), { specialTripCount: 2, specialTripCharges: 1500 });
  assert.deepEqual(customerController.calculateSpecialTripCharges(trips, routeKmTable, tempShareOf), { specialTripCount: 2, specialTripCharges: 1500 });
});

test('a trip belongs to the salary month it closes in, even when loaded the month before', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-08');
  const trip = {
    loadingDate: new Date(2026, 7, 30),
    unloadingDate: new Date(2026, 8, 1),
    turnDate: new Date(2026, 8, 3),
    dieselEntries: [{ filledAt: new Date(2026, 8, 3) }],
  };
  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), false);
  const { start: sepStart, end: sepEnd } = customerController.getSalaryMonthBounds('2026-09');
  assert.equal(customerController.isTripInSalaryMonth(trip, sepStart, sepEnd), true);
});

test('a trip closed this month moves to next month when a loading/unloading/turn date is entered there', () => {
  const { start: augStart, end: augEnd } = customerController.getSalaryMonthBounds('2026-08');
  const { start: sepStart, end: sepEnd } = customerController.getSalaryMonthBounds('2026-09');

  const closedInAugust = { loadingDate: new Date(2026, 7, 20), unloadingDate: new Date(2026, 7, 22), unTurnDate: new Date(2026, 7, 23), turnDate: new Date(2026, 7, 25), dieselEntries: [] };
  assert.equal(customerController.isTripInSalaryMonth(closedInAugust, augStart, augEnd), true);
  assert.equal(customerController.isTripInSalaryMonth(closedInAugust, sepStart, sepEnd), false);

  const unloadingNextMonth = { ...closedInAugust, unloadingDate: new Date(2026, 8, 2) };
  assert.equal(customerController.isTripInSalaryMonth(unloadingNextMonth, augStart, augEnd), false);
  assert.equal(customerController.isTripInSalaryMonth(unloadingNextMonth, sepStart, sepEnd), true);

  const unTurnNextMonth = { ...closedInAugust, unTurnDate: new Date(2026, 8, 1) };
  assert.equal(customerController.isTripInSalaryMonth(unTurnNextMonth, sepStart, sepEnd), true);

  const loadingNextMonth = { ...closedInAugust, loadingDate: new Date(2026, 8, 1) };
  assert.equal(customerController.isTripInSalaryMonth(loadingNextMonth, sepStart, sepEnd), true);
});

test('Corporation KM excludes routes below 200 KM when less than 200KM charges are enabled', () => {
  const trips = [
    { loadingLocation: 'Short', unloadingLocation: 'Route', fillingOrderLocation: 'Short' },
    { loadingLocation: 'Long', unloadingLocation: 'Route', fillingOrderLocation: 'Long' },
  ];
  const routes = [
    { loadingLocation: 'Short', unloadingLocation: 'Route', km: 199 },
    { loadingLocation: 'Short', unloadingLocation: 'Route', km: 199 },
    { loadingLocation: 'Long', unloadingLocation: 'Route', km: 500 },
    { loadingLocation: 'Long', unloadingLocation: 'Route', km: 500 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, routes, false), 699);
  assert.equal(customerController.sumRouteTableKm(trips, routes, true), 500);
});

test('Driver KM uses Manual KM for missing route legs, doubling one-way entries to round trip', () => {
  const trips = [
    { loadingLocation: 'Unknown', unloadingLocation: 'Route', manualKm: 760, manualKmReturn: 760 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, [], false), 1520);
  assert.equal(customerController.sumRouteTableKm(trips, [], true), 1520);
});

test('Driver KM falls back to Manual KM Return when the filling-order leg is missing from the table', () => {
  const trips = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', manualKmReturn: 772 },
  ];
  const routes = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 748 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, routes, false), 1146);
});

test('Driver KM uses Manual KM for both missing normal-trip legs, doubling one-way entries to round trip', () => {
  const trip = {
    loadingLocation: 'Unknown',
    unloadingLocation: 'Route',
    fillingOrderLocation: 'Filling Order',
    manualKm: 300,
    manualKmReturn: 300,
  };

  const details = getCorporationKmDetails(trip, []);
  assert.equal(details.value, 600);
  assert.equal(details.source, 'manual');
});

test('Corporation KM uses two weighted legs for normal trips', () => {
  const trip = {
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'Trichy',
    fillingOrderLocation: 'CPCL, Chennai',
  };
  const routes = [
    { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Trichy', km: 700 },
    { loadingLocation: 'CPCL, Chennai', unloadingLocation: 'Trichy', km: 900 },
  ];

  assert.deepEqual(customerController.getTripCorporationKm(trip, routes), 800);
});

test('Corporation KM uses the same route for both weighted legs when filling matches loading', () => {
  const trip = {
    loadingLocation: 'Custom Plant',
    unloadingLocation: 'Trichy',
    fillingOrderLocation: 'Custom Plant',
  };
  const routes = [{ loadingLocation: 'Custom Plant', unloadingLocation: 'Trichy', km: 610 }];

  assert.deepEqual(customerController.getTripCorporationKm(trip, routes), 610);
});

test('Corporation KM uses weighted normal legs without location groups', () => {
  const trip = {
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'Trichy',
    fillingOrderLocation: 'MRPL, Mangalore',
  };
  const routes = [
    { loadingLocation: 'IPPL, Chennai', unloadingLocation: 'Trichy', km: 700 },
    { loadingLocation: 'MRPL, Mangalore', unloadingLocation: 'Trichy', km: 900 },
  ];
  assert.equal(customerController.getTripCorporationKm(trip, routes), 800);
});

test('customerController exposes deleteVehicleUser endpoint', () => {
  assert.equal(typeof customerController.deleteVehicleUser, 'function');
});

test('vehicleController exposes updateVehicle and deleteVehicle endpoints', () => {
  assert.equal(typeof vehicleController.updateVehicle, 'function');
  assert.equal(typeof vehicleController.deleteVehicle, 'function');
});

test('trip schema supports an optional manualKm field for unloading details', () => {
  const trip = new Trip({ manualKm: 240 });
  assert.equal(trip.manualKm, 240);
});

test('trip schema supports optional manualKmDivert and manualKmReturn fields', () => {
  const trip = new Trip({ manualKmDivert: 90, manualKmReturn: 120 });
  assert.equal(trip.manualKmDivert, 90);
  assert.equal(trip.manualKmReturn, 120);
});

test('trip schema stores optional divert unloading details', () => {
  const trip = new Trip({
    isDiverted: true,
    divertUnloadingLocation: 'Alternate Depot',
    divertDate: new Date('2026-09-14'),
  });
  assert.equal(trip.isDiverted, true);
  assert.equal(trip.divertUnloadingLocation, 'Alternate Depot');
});

test('diverted Driver KM weights all three route legs at 50 percent', () => {
  const trip = {
    loadingLocation: 'Loading',
    unloadingLocation: 'Unloading',
    fillingOrderLocation: 'Filling Order',
    isDiverted: true,
    divertUnloadingLocation: 'New Unloading',
  };
  const routes = [
    { loadingLocation: 'Loading', unloadingLocation: 'Unloading', km: 100 },
    { loadingLocation: 'Unloading', unloadingLocation: 'New Unloading', km: 40 },
    { loadingLocation: 'Filling Order', unloadingLocation: 'New Unloading', km: 60 },
  ];

  assert.equal(getCorporationKmDetails(trip, routes).value, 100);
});

test('Divert route calculation takes priority over Manual KM fallback', () => {
  const trip = {
    loadingLocation: 'Loading',
    unloadingLocation: 'Unloading',
    fillingOrderLocation: 'Filling Order',
    isDiverted: true,
    divertUnloadingLocation: 'New Unloading',
    manualKm: 300,
  };
  const routes = [
    { loadingLocation: 'Loading', unloadingLocation: 'Unloading', km: 100 },
    { loadingLocation: 'Unloading', unloadingLocation: 'New Unloading', km: 40 },
    { loadingLocation: 'Filling Order', unloadingLocation: 'New Unloading', km: 60 },
  ];

  assert.equal(getCorporationKmDetails(trip, routes).value, 100);
  assert.equal(getCorporationKmDetails(trip, routes).source, 'km_table_divert_weighted');
});

test('diverted Driver KM falls back to Manual KM Divert when the divert leg is missing, doubling the one-way entry', () => {
  const trip = {
    loadingLocation: 'Loading',
    unloadingLocation: 'Unloading',
    fillingOrderLocation: 'Filling Order',
    isDiverted: true,
    divertUnloadingLocation: 'New Unloading',
    manualKmDivert: 300,
  };
  const routes = [
    { loadingLocation: 'Loading', unloadingLocation: 'Unloading', km: 100 },
    { loadingLocation: 'Filling Order', unloadingLocation: 'New Unloading', km: 60 },
  ];

  assert.equal(getCorporationKmDetails(trip, routes).value, 380);
  assert.equal(getCorporationKmDetails(trip, routes).source, 'manual');
});

test('Manual KM Return reuses Manual KM Load when filling order location equals loading location, doubling the one-way entry', () => {
  const trip = {
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'Salem Steel Plant',
    fillingOrderLocation: 'IPPL, Chennai',
    manualKm: 750,
  };

  const details = getCorporationKmDetails(trip, []);
  assert.equal(details.value, 1500);
  assert.equal(details.source, 'manual');
});

test('diverted trip with turn location matching loading location still requires Manual KM Return for the divert leg', () => {
  const trip = {
    loadingLocation: 'IPPL, Chennai',
    unloadingLocation: 'namakkal',
    fillingOrderLocation: 'IPPL, Chennai',
    isDiverted: true,
    divertUnloadingLocation: 'karur',
    manualKm: 400,
    manualKmDivert: 100,
  };

  const details = getCorporationKmDetails(trip, []);
  assert.equal(details.value, null);
  assert.equal(details.source, 'manual_required');
});

test('Manual KM Return reuses a table-resolved Load leg without any manual entry', () => {
  const trip = {
    loadingLocation: 'Loading',
    unloadingLocation: 'Unloading',
    fillingOrderLocation: 'Loading',
  };
  const routes = [
    { loadingLocation: 'Loading', unloadingLocation: 'Unloading', km: 100 },
  ];

  const details = getCorporationKmDetails(trip, routes);
  assert.equal(details.value, 100);
  assert.equal(details.source, 'km_table_weighted');
});

test('Manual KM Return reuses Manual KM Divert when filling order location equals unloading location, doubling one-way entries', () => {
  const trip = {
    loadingLocation: 'Loading',
    unloadingLocation: 'Unloading',
    fillingOrderLocation: 'Unloading',
    isDiverted: true,
    divertUnloadingLocation: 'New Unloading',
    manualKm: 100,
    manualKmDivert: 40,
  };

  const details = getCorporationKmDetails(trip, []);
  assert.equal(details.value, (200 * 0.5) + (80 * 0.5) + (80 * 0.5));
  assert.equal(details.source, 'manual');
});

test('trip KM for an unsettled trip uses the next trip first Tank Fill odometer, and is unavailable until it exists', () => {
  const currentTrip = { dieselEntries: [{ odometerKm: 4050, loadingPointTankFill: true }] };
  const nextTrip = { dieselEntries: [{ odometerKm: 4700 }, { odometerKm: 4750, loadingPointTankFill: true }] };

  assert.equal(calculateTripKm(currentTrip, nextTrip), 700);
  assert.equal(calculateTripKm(currentTrip, { dieselEntries: [] }), null);
  assert.equal(calculateTripKm(currentTrip, null), null);
});

test('meta route table exists for loading, unloading and KM values', () => {
  assert.ok(Array.isArray(ROUTE_KM_TABLE));
  const sample = ROUTE_KM_TABLE[0];
  if (sample) {
    assert.ok(typeof sample.loadingLocation === 'string');
    assert.ok(typeof sample.unloadingLocation === 'string');
    assert.ok(typeof sample.km === 'number');
  }
});

test('meta route table normalizes and sorts rows by corporation and loading location', () => {
  const rows = metaRoutes.normalizeRouteKmTable([
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', corporation: 'Zeta', km: '50' },
    { loadingLocation: 'AEGIS', unloadingLocation: 'Belgaum', corporation: 'KPS', km: '60' },
    { loadingLocation: 'Total', unloadingLocation: 'Madurai', corporation: 'KPS', km: '70' },
  ]);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].loadingLocation, 'AEGIS');
  assert.equal(rows[0].unloadingLocation, 'Belgaum');
  assert.equal(rows[0].corporation, 'KPS');
  assert.equal(rows[0].km, 60);
  assert.equal(rows[1].loadingLocation, 'Total');
  assert.equal(rows[2].loadingLocation, 'MRPL');
  assert.equal(rows[2].corporation, 'Zeta');
});

test('meta route table updates a single row by id', () => {
  const rows = [
    { id: 'row-1', loadingLocation: 'MRPL', unloadingLocation: 'Trichy', corporation: 'KPS', km: 50 },
  ];

  const updated = metaRoutes.updateRouteKmRowById(rows, 'row-1', {
    loadingLocation: 'MRPL',
    unloadingLocation: 'Madurai',
    corporation: 'KPS',
    km: '80',
  });

  assert.equal(updated.length, 1);
  assert.equal(updated[0].unloadingLocation, 'Madurai');
  assert.equal(updated[0].km, 80);
  assert.equal(updated[0].id, 'row-1');
});

test('meta route location dropdowns include both route endpoints without duplicates', () => {
  const rows = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Belgaum', corporation: 'KPS', km: 450 },
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
    { loadingLocation: 'AEGIS-Mangalore', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
    { loadingLocation: 'Total-Mangalore', unloadingLocation: 'Chengalpattu', corporation: 'KPS', km: 510 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, [
    'AEGIS-Mangalore',
    'Belgaum',
    'Chengalpattu',
    'MRPL',
    'Total-Mangalore',
    'Trichy',
  ]);
});

test('route KM table takes precedence over generic meta loading options when both are present', () => {
  const rows = [
    { loadingLocation: 'Updated-Route-Location', unloadingLocation: 'Belgaum', corporation: 'KPS', km: 450 },
    { loadingLocation: 'Another-Route-Location', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, [
    'Another-Route-Location',
    'Belgaum',
    'Trichy',
    'Updated-Route-Location',
  ]);
  assert.deepEqual(options.unloadingLocations, ['Another-Route-Location', 'Belgaum', 'Trichy', 'Updated-Route-Location']);
});

test('route km table is the only source of shared loading and unloading options', () => {
  const rows = [
    { loadingLocation: 'Master-Load', unloadingLocation: 'Master-Unload', corporation: 'KPS', km: 90 },
    { loadingLocation: 'Master-Load', unloadingLocation: 'Another-Unload', corporation: 'KPS', km: 110 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, ['Another-Unload', 'Master-Load', 'Master-Unload']);
  assert.deepEqual(options.unloadingLocations, ['Another-Unload', 'Master-Load', 'Master-Unload']);
});

test('toSafeJSON serializes populated customer and vehicle ids as strings', () => {
  const customerId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const user = new User({
    username: 'driver01',
    passwordHash: 'hash',
    role: 'vehicle_user',
    customer: customerId,
    vehicle: vehicleId,
  });

  const json = user.toSafeJSON();
  assert.equal(String(json.customer), String(customerId));
  assert.equal(String(json.vehicle), String(vehicleId));
});
