const test = require('node:test');
const assert = require('node:assert/strict');

const { isWithinInclusiveDateRange } = require('../src/controllers/trip/tripHelpers');

test('allows entry dates on the previous and current Load Turn calendar days', () => {
  const previousLoadTurnDate = new Date('2026-10-29T18:30:00.000Z');
  const currentLoadTurnDate = new Date('2026-10-30T06:15:00.000Z');

  assert.equal(isWithinInclusiveDateRange(
    new Date('2026-10-29T00:00:00.000Z'),
    previousLoadTurnDate,
    currentLoadTurnDate
  ), true);
  assert.equal(isWithinInclusiveDateRange(
    new Date('2026-10-30T00:00:00.000Z'),
    previousLoadTurnDate,
    currentLoadTurnDate
  ), true);
});

test('rejects entry dates outside the previous-to-current Load Turn range', () => {
  const previousLoadTurnDate = new Date('2026-10-29T18:30:00.000Z');
  const currentLoadTurnDate = new Date('2026-10-30T06:15:00.000Z');

  assert.equal(isWithinInclusiveDateRange(
    new Date('2026-10-28T00:00:00.000Z'),
    previousLoadTurnDate,
    currentLoadTurnDate
  ), false);
  assert.equal(isWithinInclusiveDateRange(
    new Date('2026-10-31T00:00:00.000Z'),
    previousLoadTurnDate,
    currentLoadTurnDate
  ), false);
});
