const test = require('node:test');
const assert = require('node:assert/strict');
const { getHighestOdometerReading } = require('../src/controllers/trip/tripHelpers');

test('uses diesel-fill readings as the vehicle odometer when trip starts have no reading', () => {
  const trips = [
    { startOdometerKm: null, dieselEntries: [{ odometerKm: 12000 }, { odometerKm: 12800 }] },
    { dieselEntries: [{ odometerKm: 13750 }] },
  ];

  assert.equal(getHighestOdometerReading(trips), 13750);
});

test('recalculates from remaining readings and ignores missing or invalid values', () => {
  const trips = [
    { startOdometerKm: 9000, dieselEntries: [{ odometerKm: 14000 }, { odometerKm: null }] },
    { dieselEntries: [{ odometerKm: 'invalid' }, { odometerKm: 13200 }] },
  ];

  assert.equal(getHighestOdometerReading(trips), 14000);
  assert.equal(getHighestOdometerReading([{ dieselEntries: [{ odometerKm: null }] }]), null);
});
