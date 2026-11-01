import { buildDieselVerificationRows, formatVerificationDate, formatVerificationLitres } from './dieselVerificationData';

test('builds monthly trip rows using diesel entered in each trip and uploaded statement totals', () => {
  const rows = buildDieselVerificationRows([
    {
      _id: 'trip-2',
      loadingDate: '2026-09-20T00:00:00.000Z',
      unloadingDate: '2026-09-22T00:00:00.000Z',
      turnDate: '2026-09-24T00:00:00.000Z',
      loadingLocation: 'Loading 2',
      unloadingLocation: 'Unloading 2',
      dieselEntries: [{ volumeLitres: 10 }, { volumeLitres: '5.5' }, { volumeLitres: 900 }],
      settlement: { totalDieselLitres: 55 },
    },
    {
      _id: 'trip-1',
      loadingDate: '2026-09-01T00:00:00.000Z',
      unloadingDate: '2026-09-03T00:00:00.000Z',
      loadingLocation: 'Loading 1',
      unloadingLocation: 'Unloading 1',
      dieselEntries: [],
    },
    { _id: 'other-month', loadingDate: '2026-10-01T00:00:00.000Z' },
  ], '2026-09', [{
    dieselRecords: [
      { date: '2026-08-31T00:00:00.000Z', litres: 100 },
      { date: '2026-09-01T00:00:00.000Z', litres: 20 },
      { date: '2026-09-23T00:00:00.000Z', litres: 3 },
      { date: '2026-09-24T00:00:00.000Z', litres: 4 },
      { date: '2026-09-25T00:00:00.000Z', litres: 200 },
    ],
  }]);

  expect(rows.map((row) => row.id)).toEqual(['trip-1', 'trip-2']);
  expect(rows[0]).toMatchObject({ loading: 'Loading 1', dieselFromId: 20, tripDiesel: null });
  expect(rows[1]).toMatchObject({ unloading: 'Unloading 2', dieselFromId: 7, tripDiesel: 915.5 });
});

test('shows diesel entry totals before a trip settlement is available', () => {
  const [row] = buildDieselVerificationRows([{
    _id: 'not-yet-settled-trip',
    loadingDate: '2026-09-10T00:00:00.000Z',
    unloadingDate: '2026-09-12T00:00:00.000Z',
    dieselEntries: [{ volumeLitres: 25 }, { volumeLitres: 35 }],
  }], '2026-09', []);

  expect(row.tripDiesel).toBe(60);
});

test('shows no diesel amount when a trip has no diesel entries', () => {
  const [row] = buildDieselVerificationRows([{
    _id: 'trip-without-diesel',
    loadingDate: '2026-09-10T00:00:00.000Z',
    unloadingDate: '2026-09-12T00:00:00.000Z',
    dieselEntries: [],
    settlement: { totalDieselLitres: 100 },
  }], '2026-09', []);

  expect(row.tripDiesel).toBeNull();
});

test('matches statement and trip dates by calendar day and ignores their times', () => {
  const [row] = buildDieselVerificationRows([{
    _id: 'date-only-trip',
    loadingDate: '2026-09-10T18:45:00.000Z',
    unloadingDate: '2026-09-12T03:15:00.000Z',
  }], '2026-09', [{
    dieselRecords: [
      { date: '2026-09-10T02:00:00.000Z', litres: 12 },
      { date: '2026-09-11T21:30:00.000Z', litres: 8 },
      { date: '2026-09-12T23:59:00.000Z', litres: 5 },
      { date: '2026-09-13T00:00:00.000Z', litres: 100 },
    ],
  }]);

  expect(row.dieselFromId).toBe(25);
});

test('formats verification dates and litres for the table', () => {
  expect(formatVerificationDate('2026-09-01T00:00:00.000Z')).not.toBe('—');
  expect(formatVerificationDate(null)).toBe('—');
  expect(formatVerificationLitres(12.5)).toContain('12.5');
  expect(formatVerificationLitres(null)).toBe('—');
});
