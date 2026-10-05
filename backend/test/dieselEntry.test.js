const test = require('node:test');
const assert = require('node:assert/strict');

const { dieselEntryError } = require('../src/controllers/trip/tripHelpers');
const { DIESEL_MIN_LITRES, DIESEL_MIN_RATE_PER_LITRE } = require('../src/config/constants');

test('diesel limits are 5 litres and Rs 50 per litre', () => {
  assert.equal(DIESEL_MIN_LITRES, 5);
  assert.equal(DIESEL_MIN_RATE_PER_LITRE, 50);
});

test('a fill must be more than 5 litres', () => {
  assert.match(dieselEntryError(5, 500), /more than 5 litres/);
  assert.match(dieselEntryError(2, 200), /more than 5 litres/);
  assert.equal(dieselEntryError(5.01, 500), null);
});

test('the price must be more than Rs 50 per litre', () => {
  assert.match(dieselEntryError(100, 5000), /more than Rs 50 per litre/); // exactly 50/L
  assert.match(dieselEntryError(100, 4999), /entered 49\.99\/L/);
  assert.equal(dieselEntryError(100, 5001), null);
  assert.equal(dieselEntryError(40, 3700), null); // 92.50/L
});

test('garbage input is still rejected with the generic message', () => {
  assert.match(dieselEntryError(NaN, 100), /valid positive numbers/);
  assert.match(dieselEntryError(10, -1), /valid positive numbers/);
  assert.match(dieselEntryError(0, 100), /valid positive numbers/);
});
