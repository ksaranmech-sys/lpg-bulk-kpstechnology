const test = require('node:test');
const assert = require('node:assert/strict');

const { rules } = require('../src/middleware/validate');

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
  const validExpense = { vehicleId: '507f1f77bcf86cd799439011', category: 'Tyre', amount: 1500, date: '2026-10-12' };
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
