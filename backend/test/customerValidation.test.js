const test = require('node:test');
const assert = require('node:assert/strict');

const { rules } = require('../src/middleware/validate');
const Vehicle = require('../src/models/Vehicle');
const vehicleController = require('../src/controllers/vehicleController');
const { withTyreExpenseNumbers } = require('../src/utils/vehicleTyres');

// Runs an express-validator rule set against a fake request and resolves to the
// 400 body (if rejected) or null (if the chain called next()).
async function run(chain, body, params = {}) {
  const req = { body, params, query: {}, cookies: {}, headers: {} };
  let rejected = null;
  const res = {
    status(code) { rejected = { code }; return this; },
    json(payload) { rejected = { ...rejected, ...payload }; },
  };
  for (const handler of chain) {
    let advanced = false;
    await handler(req, res, () => { advanced = true; });
    if (!advanced) break;
  }
  return rejected;
}

const validCreate = {
  companyName: 'Alpha Beta Gas',
  mobileNumber: '9876543210',
  email: 'owner@alphabeta.in',
  adminUsername: 'alphabetagas',
  adminPassword: 'secret123',
};

test('createCustomer accepts a company name of letters and spaces', async () => {
  assert.equal(await run(rules.createCustomer, validCreate), null);
});

test('usernames may contain hyphens but no other special characters', async () => {
  assert.equal(await run(rules.createCustomer, { ...validCreate, adminUsername: 'aravinth-01' }), null);
  for (const adminUsername of ['aravinth_01', 'aravinth.01', 'aravinth 01', 'ab']) {
    const result = await run(rules.createCustomer, { ...validCreate, adminUsername });
    assert.equal(result?.field, 'adminUsername', `expected "${adminUsername}" to be rejected`);
  }
});

test('createCustomer rejects company names with digits or symbols', async () => {
  for (const companyName of ['Alpha 123', 'Alpha & Co', 'Alpha-Beta', '   ']) {
    const result = await run(rules.createCustomer, { ...validCreate, companyName });
    assert.equal(result?.code, 400, `expected "${companyName}" to be rejected`);
    assert.equal(result.field, 'companyName');
  }
});

test('createCustomer rejects emails without @ or containing spaces', async () => {
  for (const email of ['owner.alphabeta.in', 'owner @alphabeta.in', 'owner@alpha beta.in', 'owner@alphabeta']) {
    const result = await run(rules.createCustomer, { ...validCreate, email });
    assert.equal(result?.code, 400, `expected "${email}" to be rejected`);
    assert.equal(result.field, 'email');
  }
});

test('vehicle expense amount must be a whole number', async () => {
  const validExpense = {
    vehicleId: '507f1f77bcf86cd799439011',
    category: 'Tyre',
    tyreMaker: 'Maker',
    tyreModel: 'Model',
    tyrePosition: 'Front Tyre',
    tyreNumber: 'T-1',
    tyreNumber2: 'T-2',
    amount: 1500,
    date: '2026-10-12',
  };
  assert.equal(await run(rules.createVehicleExpense, validExpense), null);
  assert.equal(await run(rules.createVehicleExpense, { ...validExpense, amount: '1500' }), null);
  for (const amount of [1500.5, '1500.50', '-1', 'abc']) {
    const result = await run(rules.createVehicleExpense, { ...validExpense, amount });
    assert.equal(result?.field, 'amount', `expected ${JSON.stringify(amount)} to be rejected`);
  }

  const params = { expenseId: '507f1f77bcf86cd799439011' };
  assert.equal(await run(rules.updateVehicleExpense, { amount: 200 }, params), null);
  assert.equal((await run(rules.updateVehicleExpense, { amount: 200.25 }, params))?.field, 'amount');
});

test('tyre expenses require maker, model, position, and two tyre numbers', async () => {
  const validExpense = { vehicleId: '507f1f77bcf86cd799439011', category: 'Tyre', amount: 1500, date: '2026-10-12' };
  assert.equal((await run(rules.createVehicleExpense, validExpense))?.field, 'tyreMaker');
  const tyreDetails = {
    tyreMaker: 'Maker',
    tyreModel: 'Model',
    tyrePosition: 'Front Tyre',
    tyreNumber: 'T-1',
    tyreNumber2: 'T-2',
  };
  assert.equal(await run(rules.createVehicleExpense, { ...validExpense, ...tyreDetails }), null);
  assert.equal(await run(rules.createVehicleExpense, { ...validExpense, ...tyreDetails, category: 'Tyre Rebutton' }), null);
  assert.equal((await run(rules.createVehicleExpense, { ...validExpense, ...tyreDetails, tyrePosition: 'Tyre 8' }))?.field, 'tyrePosition');
  assert.equal((await run(rules.createVehicleExpense, { ...validExpense, ...tyreDetails, tyreNumber2: '' }))?.field, 'tyreNumber2');
  assert.equal(await run(rules.createVehicleExpense, { ...validExpense, category: 'Paint' }), null);

  const params = { expenseId: '507f1f77bcf86cd799439011' };
  assert.equal((await run(rules.updateVehicleExpense, { category: 'Tyre Rebutton' }, params))?.field, 'tyreMaker');
  assert.equal(await run(rules.updateVehicleExpense, { category: 'Tyre Rebutton', ...tyreDetails }, params), null);
});

test('vehicle maintenance components require unique names and non-negative odometer values', async () => {
  const validComponents = [
    { name: 'Engine Oil', startingOdometerKm: 1000, expectedKm: 5000, reminderKm: 500 },
    { name: 'Manual entry', startingOdometerKm: null, expectedKm: null, reminderKm: null },
  ];
  assert.equal(await run(rules.updateVehicleMaintenance, { maintenanceComponents: validComponents }), null);
  assert.equal((await run(rules.updateVehicleMaintenance, {
    maintenanceComponents: [...validComponents, { name: 'engine oil', startingOdometerKm: null, expectedKm: null }],
  }))?.field, 'maintenanceComponents');
  assert.equal((await run(rules.updateVehicleMaintenance, {
    maintenanceComponents: [{ name: 'Engine Oil', startingOdometerKm: -1, expectedKm: null }],
  }))?.field, 'maintenanceComponents');
  assert.equal((await run(rules.updateVehicleMaintenance, {
    maintenanceComponents: [{ name: 'Engine Oil', startingOdometerKm: null, expectedKm: null, reminderKm: -1 }],
  }))?.field, 'maintenanceComponents');
  assert.equal((await run(rules.updateVehicleMaintenance, {
    maintenanceComponents: [null],
  }))?.field, 'maintenanceComponents');
});

test('trip starts require a non-negative odometer reading', async () => {
  assert.equal(await run(rules.createTrip, { startOdometerKm: 0 }), null);
  assert.equal(await run(rules.createTrip, { startOdometerKm: '12500' }), null);
  assert.equal((await run(rules.createTrip, {}))?.field, 'startOdometerKm');
  assert.equal((await run(rules.createTrip, { startOdometerKm: -1 }))?.field, 'startOdometerKm');
});

test('vehicle tyre updates require exactly seven valid positions', async () => {
  const tyres = Array.from({ length: 7 }, (_, index) => ({
    position: index + 1,
    tyreNumber: `T-${index + 1}`,
    tyreNumber2: `T2-${index + 1}`,
    installedOdometerKm: 1000,
    expectedMileageKm: 50000,
  }));
  assert.equal(await run(rules.updateVehicleTyres, { tyres }), null);
  assert.equal((await run(rules.updateVehicleTyres, { tyres: tyres.slice(0, 6) }))?.field, 'tyres');
  assert.equal((await run(rules.updateVehicleTyres, { tyres: tyres.map((tyre) => (
    tyre.position === 7 ? { ...tyre, installedOdometerKm: -1 } : tyre
  )) }))?.field, 'tyres');
  assert.equal((await run(rules.updateVehicleTyres, { tyres: tyres.map((tyre) => (
    tyre.position === 7 ? { ...tyre, expectedMileageKm: -1 } : tyre
  )) }))?.field, 'tyres');
  assert.equal((await run(rules.updateVehicleTyres, { tyres: tyres.map((tyre) => (
    tyre.position === 7 ? { ...tyre, tyreNumber2: 'x'.repeat(51) } : tyre
  )) }))?.field, 'tyres');
});

test('vehicles initialize seven tyre positions', () => {
  const vehicle = new Vehicle({ customer: '507f1f77bcf86cd799439011', vehicleNumber: 'KA01AB1234' });
  assert.equal(vehicle.tyres.length, 7);
  assert.deepEqual(vehicle.tyres.map((tyre) => tyre.position), [1, 2, 3, 4, 5, 6, 7]);
});

test('tyre mileage is calculated from the current vehicle odometer', () => {
  const tyres = [
    { position: 1, installedOdometerKm: 1000 },
    { position: 2, installedOdometerKm: null },
  ];
  assert.deepEqual(vehicleController.withTyreMileage(tyres, 3500).map((tyre) => tyre.mileageKm), [2500, null]);
  assert.equal(vehicleController.withTyreMileage(tyres, null)[0].mileageKm, null);
  assert.equal(vehicleController.withTyreMileage(tyres, 900)[0].mileageKm, null);
});

test('vehicle tyre details fall back to the latest matching tyre expense numbers', () => {
  const vehicleId = 'vehicle-1';
  const tyres = [
    { position: 1, tyreNumber: '', tyreNumber2: '' },
    { position: 2, tyreNumber: 'MANUAL-1', tyreNumber2: '' },
  ];
  const expenses = [
    { vehicle: { _id: vehicleId }, category: 'TYRE', tyrePosition: ' front tyre ', tyreNumber: 'SEP-1', tyreNumber2: '' },
    { vehicle: vehicleId, category: 'Tyre Rebutton', tyrePosition: 'Front Tyre', tyreNumber: 'OLD-1', tyreNumber2: 'OLD-2' },
    { vehicle: vehicleId, category: 'Tyre', tyrePosition: 'Right Center', tyreNumber: 'RC-1', tyreNumber2: 'RC-2' },
    { vehicle: 'another-vehicle', category: 'Tyre', tyrePosition: 'Front Tyre', tyreNumber: 'OTHER-1', tyreNumber2: 'OTHER-2' },
  ];

  assert.deepEqual(
    withTyreExpenseNumbers(tyres, vehicleId, expenses),
    [
      { position: 1, tyreNumber: 'SEP-1', tyreNumber2: 'OLD-2' },
      { position: 2, tyreNumber: 'MANUAL-1', tyreNumber2: 'RC-2' },
    ],
  );
});

test('forgot-password takes a recovery email and reset uses a 64-hex token', async () => {
  assert.equal(await run(rules.forgotPassword, { username: 'kpstransports', recoveryEmail: 'owner@kps.in' }), null);
  assert.equal((await run(rules.forgotPassword, { username: 'kpstransports', recoveryEmail: 'owner kps.in' }))?.field, 'recoveryEmail');
  assert.equal((await run(rules.forgotPassword, { username: 'kpstransports', recoveryMobile: '9876543210' }))?.field, 'recoveryEmail');

  const token = 'a'.repeat(64);
  assert.equal(await run(rules.resetPasswordWithToken, { token, newPassword: 'secret123' }), null);
  assert.equal((await run(rules.resetPasswordWithToken, { token: '123456', newPassword: 'secret123' }))?.field, 'token');
  assert.equal((await run(rules.resetPasswordWithToken, { token, newPassword: '123' }))?.field, 'newPassword');
});

test('updateCustomer applies the same company name and email rules when provided', async () => {
  const params = { customerId: '507f1f77bcf86cd799439011' };
  assert.equal(await run(rules.updateCustomer, { companyName: 'Gamma Fuels', email: 'a@b.co' }, params), null);
  assert.equal(await run(rules.updateCustomer, {}, params), null);

  const badName = await run(rules.updateCustomer, { companyName: 'Gamma 9' }, params);
  assert.equal(badName?.field, 'companyName');

  const badEmail = await run(rules.updateCustomer, { email: 'no-at-sign' }, params);
  assert.equal(badEmail?.field, 'email');
});
