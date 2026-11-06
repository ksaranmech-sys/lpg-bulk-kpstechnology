const test = require('node:test');
const assert = require('node:assert/strict');
const { isClosedTripEditable } = require('../src/utils/tripEditPolicy');

test('allows closed trips from the current month', () => {
  assert.equal(
    isClosedTripEditable(
      { loadingDate: '2026-10-01T00:00:00.000Z' },
      new Date('2026-10-17T05:00:00.000Z')
    ),
    true
  );
});

test('allows previous-month trips through the 10th in India time', () => {
  const trip = { loadingDate: '2026-09-15T00:00:00.000Z' };
  assert.equal(isClosedTripEditable(trip, new Date('2026-10-10T18:29:59.000Z')), true);
  assert.equal(isClosedTripEditable(trip, new Date('2026-10-10T18:30:00.000Z')), false);
});

test('uses the trip salary month when its dates span months', () => {
  const trip = {
    loadingDate: '2026-09-30T00:00:00.000Z',
    unloadingDate: '2026-10-03T00:00:00.000Z',
    turnDate: '2026-10-04T00:00:00.000Z',
  };
  assert.equal(isClosedTripEditable(trip, new Date('2026-11-10T18:29:59.000Z')), true);
  assert.equal(isClosedTripEditable(trip, new Date('2026-11-10T18:30:00.000Z')), false);
});

test('does not allow older months, future months, or invalid trip dates', () => {
  const now = new Date('2026-10-05T12:00:00.000Z');
  assert.equal(isClosedTripEditable({ loadingDate: '2026-08-31T00:00:00.000Z' }, now), false);
  assert.equal(isClosedTripEditable({ loadingDate: '2026-11-01T00:00:00.000Z' }, now), false);
  assert.equal(isClosedTripEditable({ loadingDate: 'not-a-date' }, now), false);
});
