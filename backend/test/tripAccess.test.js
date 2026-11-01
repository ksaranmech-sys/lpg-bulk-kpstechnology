const test = require('node:test');
const assert = require('node:assert/strict');
const Trip = require('../src/models/Trip');
const { ROLES, TRIP_STATUS } = require('../src/config/constants');
const { scopeToOpenTripForUser } = require('../src/middleware/tripAccess');

async function runScope(user, trip) {
  const originalFindById = Trip.findById;
  let nextCalled = false;
  let responseStatus;
  let responseBody;
  Trip.findById = async () => trip;

  try {
    await scopeToOpenTripForUser(
      { params: { tripId: 'trip-1' }, user },
      {
        status(status) {
          responseStatus = status;
          return this;
        },
        json(body) {
          responseBody = body;
          return this;
        },
      },
      () => { nextCalled = true; },
    );
  } finally {
    Trip.findById = originalFindById;
  }

  return { nextCalled, responseStatus, responseBody };
}

test('customer admin can edit their own customer trip during its trip month', async () => {
  const now = new Date();
  const trip = {
    customer: 'customer-1',
    vehicle: 'vehicle-1',
    status: TRIP_STATUS.CLOSED,
    loadingDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
  };
  const result = await runScope(
    { id: 'admin-1', role: ROLES.CUSTOMER_ADMIN, customer: 'customer-1' },
    trip,
  );

  assert.equal(result.nextCalled, true);
  assert.equal(result.responseStatus, undefined);
});

test('customer admin cannot edit another customer trip', async () => {
  const result = await runScope(
    { id: 'admin-1', role: ROLES.CUSTOMER_ADMIN, customer: 'customer-1' },
    { customer: 'customer-2', loadingDate: new Date() },
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.responseStatus, 403);
  assert.match(result.responseBody.error, /does not belong/);
});

test('super admin cannot edit trip entries after the salary edit window', async () => {
  const result = await runScope(
    { id: 'admin-1', role: ROLES.SUPER_ADMIN },
    { customer: 'customer-1', loadingDate: '2020-01-15T00:00:00.000Z' },
  );

  assert.equal(result.nextCalled, false);
  assert.equal(result.responseStatus, 403);
  assert.match(result.responseBody.error, /through the 5th/);
});
