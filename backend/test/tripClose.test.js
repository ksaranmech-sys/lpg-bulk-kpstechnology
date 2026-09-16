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
const { calculateClosingOdometerKm, computeTripSettlement } = require('../src/utils/tripCalculations');
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
    status: { $in: ['pending_close', 'closed'] },
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

test('settlement mileage is unavailable when the first Tank Fill marker is not selected', () => {
  const result = computeTripSettlement({
    dieselEntries: [{ odometerKm: 1000, loadingPointTankFill: false, volumeLitres: 10, amount: 100 }],
    driverAdvances: [],
    loadingExpense: 0,
    unloadingExpense: 0,
    rtoEntries: [],
    otherExpenses: [],
  }, {
    dieselEntries: [{ odometerKm: 1500, loadingPointTankFill: true, volumeLitres: 20, amount: 200 }],
  });

  assert.equal(result.settlement.totalKm, null);
  assert.equal(result.settlement.mileageKmPerLitre, null);
  assert.equal(result.settlement.totalDieselLitres, 20);
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

test('Driver KM uses Manual KM for missing route legs', () => {
  const trips = [
    { loadingLocation: 'Unknown', unloadingLocation: 'Route', manualKm: 760 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, [], false), 760);
  assert.equal(customerController.sumRouteTableKm(trips, [], true), 760);
});

test('Driver KM uses Manual KM for a missing filling-order leg', () => {
  const trips = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', manualKm: 760 },
  ];
  const routes = [
    { loadingLocation: 'MRPL', unloadingLocation: 'Trichy', km: 748 },
  ];

  assert.equal(customerController.sumRouteTableKm(trips, routes, false), 754);
});

test('Driver KM uses Manual KM for both missing normal-trip legs', () => {
  const trip = {
    loadingLocation: 'Unknown',
    unloadingLocation: 'Route',
    fillingOrderLocation: 'Filling Order',
    manualKm: 300,
  };

  const details = getCorporationKmDetails(trip, []);
  assert.equal(details.value, 300);
  assert.equal(details.source, 'manual_weighted');
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

test('trip schema stores optional divert unloading details', () => {
  const trip = new Trip({
    isDiverted: true,
    divertUnloadingLocation: 'Alternate Depot',
    divertDate: new Date('2026-09-14'),
    divertKm: 35,
  });
  assert.equal(trip.isDiverted, true);
  assert.equal(trip.divertUnloadingLocation, 'Alternate Depot');
  assert.equal(trip.divertKm, 35);
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

test('diverted Driver KM uses Manual KM for a missing automatic leg', () => {
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
    { loadingLocation: 'Filling Order', unloadingLocation: 'New Unloading', km: 60 },
  ];

  assert.equal(getCorporationKmDetails(trip, routes).value, 230);
  assert.equal(getCorporationKmDetails(trip, routes).source, 'manual_divert_weighted');
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
