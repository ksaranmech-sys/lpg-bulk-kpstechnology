import {
  buildAdvanceVerificationRows,
  formatVerificationAmount,
  getAdvanceVerificationDateRange,
} from './advanceVerificationData';

test('compares trip advances with statement records in previous-to-current load-turn intervals', () => {
  const trips = [{
    _id: 'trip-1',
    loadingDate: '2026-09-01T00:00:00.000Z',
    turnDate: '2026-09-09T00:00:00.000Z',
    loadingLocation: 'Loading 1',
    unloadingLocation: 'Unloading 1',
    unloadingDate: '2026-09-03T00:00:00.000Z',
    driverAdvances: [{ amount: 1000 }, { amount: '500' }],
  }, {
    _id: 'trip-2',
    loadingDate: '2026-09-10T00:00:00.000Z',
    turnDate: '2026-09-19T00:00:00.000Z',
    driverAdvances: [{ amount: 2000 }],
  }];
  const uploads = [{
    advanceRecords: [
      { date: '2026-08-31T00:00:00.000Z', amount: 80 },
      { date: '2026-09-09T00:00:00.000Z', amount: 400 },
      { date: '2026-09-10T00:00:00.000Z', amount: 600 },
      { date: '2026-09-15T00:00:00.000Z', amount: 900 },
      { date: '2026-09-20T00:00:00.000Z', amount: 100 },
    ],
  }];

  expect(buildAdvanceVerificationRows(trips, '2026-09', uploads)).toEqual([
    {
      id: 'trip-1',
      loading: 'Loading 1',
      unloading: 'Unloading 1',
      unloadingDate: '2026-09-03T00:00:00.000Z',
      advancesAdded: 1500,
      advanceFromDocument: 480,
    },
    {
      id: 'trip-2',
      loading: '',
      unloading: '',
      unloadingDate: null,
      advancesAdded: 2000,
      advanceFromDocument: 1500,
    },
  ]);
  expect(getAdvanceVerificationDateRange(trips, '2026-09', uploads)).toEqual({
    fromDate: '2026-08-31',
    toDate: '2026-09-19',
  });
});

test('uses salary-month trips rather than grouping verification by loading month', () => {
  const rows = buildAdvanceVerificationRows([
    {
      _id: 'closed-in-selected-month',
      loadingDate: '2026-09-28T00:00:00.000Z',
      turnDate: '2026-10-02T00:00:00.000Z',
      driverAdvances: [{ amount: 10 }],
    },
    {
      _id: 'not-yet-salary-ready',
      status: 'open',
      loadingDate: '2026-10-05T00:00:00.000Z',
    },
    {
      _id: 'salary-date-next-month',
      status: 'closed',
      loadingDate: '2026-10-20T00:00:00.000Z',
      turnDate: '2026-11-02T00:00:00.000Z',
    },
  ], '2026-10', []);

  expect(rows.map((row) => row.id)).toEqual(['closed-in-selected-month']);
});

test('filters statement rows by vehicle and leaves unmatched trips visible', () => {
  const trips = [{
    _id: 'trip-1',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
    driverAdvances: [],
  }];
  const uploads = [{
    defaultVehicleNumber: 'KA01AH6269',
    advanceRecords: [
      { date: '2026-10-02T00:00:00.000Z', amount: 100, vehicleNumber: '6269' },
      { date: '2026-10-03T00:00:00.000Z', amount: 200, vehicleNumber: 'KA02AB1234' },
    ],
  }];

  expect(buildAdvanceVerificationRows(trips, '2026-10', uploads, 'KA01AH6269')[0]).toMatchObject({
    advancesAdded: null,
    advanceFromDocument: 100,
  });
  expect(buildAdvanceVerificationRows(trips, '2026-10', uploads, 'KA02AB1234')[0].advanceFromDocument).toBe(200);
});

test('matches statement rows by driver mobile without assigning them to the upload vehicle', () => {
  const trips = [{
    _id: 'previous-trip',
    loadingDate: '2026-09-10T00:00:00.000Z',
    turnDate: '2026-09-25T00:00:00.000Z',
  }, {
    _id: 'trip-1',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
    driverAdvances: [],
  }];
  const uploads = [{
    defaultVehicleNumber: 'KA01AH6269',
    advanceRecords: [
      { date: '2026-10-02T00:00:00.000Z', amount: 100, driverMobileNumber: '9876543210' },
      { date: '2026-10-02T00:00:00.000Z', amount: 50, driverMobileNumber: '9876543210' },
      { date: '2026-10-03T00:00:00.000Z', amount: 200, driverMobileNumber: '9123456789' },
    ],
  }];

  expect(buildAdvanceVerificationRows(
    trips,
    '2026-10',
    uploads,
    'KA02AB1234',
    '+91 98765 43210'
  )[0].advanceFromDocument).toBe(150);
  expect(buildAdvanceVerificationRows(
    trips,
    '2026-10',
    uploads,
    'KA02AB1234',
    '9000000000'
  )[0].advanceFromDocument).toBe(0);
});

test('returns null for unavailable interval data and formats currency amounts', () => {
  expect(buildAdvanceVerificationRows([{
    _id: 'unsettled-trip',
    status: 'closed',
    loadingDate: '2026-10-01T00:00:00.000Z',
    driverAdvances: [{ amount: 50 }],
  }], '2026-10', [])[0]).toMatchObject({
    advancesAdded: 50,
    advanceFromDocument: null,
  });
  expect(formatVerificationAmount(1234.5)).toContain('1,234.5');
  expect(formatVerificationAmount(null)).toBe('—');
});
