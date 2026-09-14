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
const { calculateClosingOdometerKm } = require('../src/utils/tripCalculations');

test('tripController exposes a closeTrip endpoint', () => {
  assert.equal(typeof tripController.closeTrip, 'function');
});

test('closed trip month uses the closing diesel filled date', () => {
  const closingDate = new Date('2026-08-31T18:30:00.000Z');

  assert.equal(tripController.getClosingDieselDate({ dieselEntries: [{ filledAt: closingDate }] }).getTime(), closingDate.getTime());
  assert.equal(tripController.getClosingDieselDate({ dieselEntries: [] }), null);
});

test('tripController exposes a deleteDieselEntry endpoint', () => {
  assert.equal(typeof tripController.deleteDieselEntry, 'function');
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

test('authController exposes admin password reset helpers', () => {
  assert.equal(typeof authController.resetUserPassword, 'function');
  assert.equal(typeof authController.resetAllAdminPasswords, 'function');
});

test('customerController exposes updateCustomer endpoint', () => {
  assert.equal(typeof customerController.updateCustomer, 'function');
});

test('customerController exposes updateVehicleUser endpoint', () => {
  assert.equal(typeof customerController.updateVehicleUser, 'function');
});

test('monthly salary is available from the 5th of the following month', () => {
  const unavailable = customerController.getSalaryAvailability('2026-08', new Date(2026, 8, 4));
  const available = customerController.getSalaryAvailability('2026-08', new Date(2026, 8, 5));

  assert.equal(unavailable.available, false);
  assert.equal(available.available, true);
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

test('monthly salary assigns trips to their closed month when the trip was closed in August', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-08');
  const filter = customerController.getClosedTripsMonthFilter(start, end);

  assert.equal(start.getFullYear(), 2026);
  assert.equal(start.getMonth(), 7);
  assert.equal(end.getFullYear(), 2026);
  assert.equal(end.getMonth(), 8);
  assert.deepEqual(filter, {
    status: 'closed',
  });
});

test('salary month uses the final diesel fill when closedAt is missing', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-07');
  const trip = { closedAt: null, dieselEntries: [{ filledAt: new Date('2026-07-24T00:00:00.000Z') }] };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
  assert.equal(customerController.getTripClosedDate(trip).toISOString(), '2026-07-24T00:00:00.000Z');
});

test('final closing diesel date takes precedence over stale closedAt', () => {
  const { start, end } = customerController.getSalaryMonthBounds('2026-07');
  const trip = {
    closedAt: new Date('2026-08-02T00:00:00.000Z'),
    dieselEntries: [{ filledAt: new Date('2026-07-24T00:00:00.000Z') }],
  };

  assert.equal(customerController.isTripInSalaryMonth(trip, start, end), true);
});

test('COP KM is the sum of matching route KM table entries for closed trips', () => {
  const total = customerController.sumRouteTableKm([
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', settlement: { totalKm: 999 } },
    { loadingLocation: 'AEGIS', unloadingLocation: 'Belgaum', settlement: { totalKm: 1 } },
    { loadingLocation: 'Unknown', unloadingLocation: 'Unknown', settlement: { totalKm: 500 } },
  ], [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 450 },
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

test('Corporation KM excludes routes below 200 KM when less than 200KM charges are enabled', () => {
  const trips = [
    { loadingLocation: 'Short', unloadingLocation: 'Route' },
    { loadingLocation: 'Long', unloadingLocation: 'Route' },
  ];
  const routes = [
    { loadingLocation: 'Short', unloadingLocation: 'Route', km: 199 },
    { loadingLocation: 'Long', unloadingLocation: 'Route', km: 500 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, routes, false), 699);
  assert.equal(customerController.sumRouteTableKm(trips, routes, true), 500);
});

test('Corporation KM falls back to manual KM when route is missing', () => {
  const trips = [
    { loadingLocation: 'Unknown', unloadingLocation: 'Route', manualKm: 760 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, [], false), 760);
  assert.equal(customerController.sumRouteTableKm(trips, [], true), 760);
});

test('Corporation KM prioritizes manual KM over the route table', () => {
  const trips = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', manualKm: 760 },
  ];
  const routes = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 748 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, routes), 760);
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

test('odometer KM uses current and previous trip closing diesel odometers', () => {
  const currentTrip = { dieselEntries: [{ odometerKm: 1000 }, { odometerKm: 1450 }] };
  const previousTrip = { dieselEntries: [{ odometerKm: 700 }, { odometerKm: 900 }] };

  assert.equal(calculateClosingOdometerKm(currentTrip, previousTrip), 550);
  assert.equal(calculateClosingOdometerKm(currentTrip, { dieselEntries: [] }), null);
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

test('meta route loading dropdown matches the route KM table loading location column without duplicates', () => {
  const rows = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Belgaum', corporation: 'KPS', km: 450 },
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
    { loadingLocation: 'AEGIS-Mangalore', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
    { loadingLocation: 'Total-Mangalore', unloadingLocation: 'Chengalpattu', corporation: 'KPS', km: 510 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, ['AEGIS-Mangalore', 'MRPL', 'Total-Mangalore']);
});

test('route KM table takes precedence over generic meta loading options when both are present', () => {
  const rows = [
    { loadingLocation: 'Updated-Route-Location', unloadingLocation: 'Belgaum', corporation: 'KPS', km: 450 },
    { loadingLocation: 'Another-Route-Location', unloadingLocation: 'Trichy', corporation: 'KPS', km: 620 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, ['Another-Route-Location', 'Updated-Route-Location']);
  assert.deepEqual(options.unloadingLocations, ['Belgaum', 'Trichy']);
});

test('route km table is the only source of loading and unloading options', () => {
  const rows = [
    { loadingLocation: 'Master-Load', unloadingLocation: 'Master-Unload', corporation: 'KPS', km: 90 },
    { loadingLocation: 'Master-Load', unloadingLocation: 'Another-Unload', corporation: 'KPS', km: 110 },
  ];

  const options = metaRoutes.buildLocationOptions(rows);

  assert.deepEqual(options.loadingLocations, ['Master-Load']);
  assert.deepEqual(options.unloadingLocations, ['Another-Unload', 'Master-Unload']);
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
