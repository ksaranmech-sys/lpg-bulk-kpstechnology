import {
  buildDieselVerificationRows,
  formatVerificationDate,
  formatVerificationKilometres,
  formatVerificationLitres,
  formatVerificationMileage,
  getDieselVerificationDateRange,
} from './dieselVerificationData';

test('builds monthly trip rows using the statement start date for the first trip and load-turn dates thereafter', () => {
  const rows = buildDieselVerificationRows([
    {
      _id: 'trip-2',
      loadingDate: '2026-09-20T00:00:00.000Z',
      unloadingDate: '2026-09-22T00:00:00.000Z',
      turnDate: '2026-09-24T00:00:00.000Z',
      loadingLocation: 'Loading 2',
      loadingWeightTons: 17.5,
      unloadingLocation: 'Unloading 2',
      dieselEntries: [{ volumeLitres: 10 }, { volumeLitres: '5.5' }, { volumeLitres: 900 }],
      settlement: { totalDieselLitres: 55, totalKm: 1250.5, mileageKmPerLitre: 2.74 },
    },
    {
      _id: 'trip-1',
      loadingDate: '2026-09-01T00:00:00.000Z',
      unloadingDate: '2026-09-03T00:00:00.000Z',
      turnDate: '2026-09-19T00:00:00.000Z',
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
  expect(rows[0]).toMatchObject({ loading: 'Loading 1', dieselFromDocument: 120, tripDiesel: null });
  expect(rows[1]).toMatchObject({
    loadingWeightTons: 17.5,
    unloading: 'Unloading 2',
    tripKm: 1250.5,
    mileageKmPerLitre: 2.74,
    dieselFromDocument: 7,
    tripDiesel: 915.5,
  });
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

test('matches uploaded diesel between previous and current load-turn dates by calendar day', () => {
  const rows = buildDieselVerificationRows([{
    _id: 'previous-trip',
    createdAt: '2026-09-01T00:00:00.000Z',
    loadingDate: '2026-09-01T00:00:00.000Z',
    turnDate: '2026-09-10T18:45:00.000Z',
  }, {
    _id: 'date-only-trip',
    createdAt: '2026-09-11T00:00:00.000Z',
    loadingDate: '2026-09-10T18:45:00.000Z',
    turnDate: '2026-09-12T03:15:00.000Z',
    unloadingDate: '2026-09-12T03:15:00.000Z',
  }], '2026-09', [{
    dieselRecords: [
      { date: '2026-09-09T02:00:00.000Z', litres: 100 },
      { date: '2026-09-10T02:00:00.000Z', litres: 12 },
      { date: '2026-09-11T21:30:00.000Z', litres: 8 },
      { date: '2026-09-12T23:59:00.000Z', litres: 5 },
      { date: '2026-09-13T00:00:00.000Z', litres: 100 },
    ],
  }]);

  expect(rows.find((row) => row.id === 'date-only-trip').dieselFromDocument).toBe(13);
});

test('counts each statement date in only one trip row while summing same-day fills', () => {
  const rows = buildDieselVerificationRows([{
    _id: 'first-trip',
    loadingDate: '2026-09-01T00:00:00.000Z',
    turnDate: '2026-09-10T00:00:00.000Z',
  }, {
    _id: 'second-trip',
    loadingDate: '2026-09-11T00:00:00.000Z',
    turnDate: '2026-09-12T00:00:00.000Z',
  }], '2026-09', [{
    dieselRecords: [
      { date: '2026-09-10T00:00:00.000Z', litres: 12 },
      { date: '2026-09-10T14:00:00.000Z', litres: 8 },
      { date: '2026-09-11T00:00:00.000Z', litres: 5 },
      { date: '2026-09-12T00:00:00.000Z', litres: 7 },
    ],
  }]);

  expect(rows.map((row) => row.dieselFromDocument)).toEqual([20, 12]);
});

test('sums distinct fills with the same date from the same statement', () => {
  const rows = buildDieselVerificationRows([{
    _id: 'current-trip',
    loadingDate: '2026-10-09T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
  }], '2026-10', [{
    dieselRecords: [
      { date: '2026-10-09T00:00:00.000Z', litres: 310 },
      { date: '2026-10-09T00:00:00.000Z', litres: 310 },
    ],
  }]);

  expect(rows[0].dieselFromDocument).toBe(620);
});

test('uses customer statements for all vehicles but assigns unnumbered rows to the uploader vehicle', () => {
  const trips = [{
    _id: 'selected-trip',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
  }];
  const uploads = [{
    defaultVehicleNumber: 'KA01AH6269',
    dieselRecords: [
      { date: '2026-10-05T00:00:00.000Z', litres: 20, vehicleNumber: 'KA01AH6269' },
      { date: '2026-10-06T00:00:00.000Z', litres: 30, vehicleNumber: 'KA02AB1234' },
      { date: '2026-10-07T00:00:00.000Z', litres: 15 },
    ],
  }];

  expect(buildDieselVerificationRows(trips, '2026-10', uploads, 'KA01AH6269')[0].dieselFromDocument).toBe(35);
  expect(buildDieselVerificationRows(trips, '2026-10', uploads, 'KA02AB1234')[0].dieselFromDocument).toBe(30);
});

test('sums statement records across distinct customer uploads', () => {
  const trips = [{
    _id: 'selected-trip',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
  }];
  const uploads = [{
    dieselRecords: [{ date: '2026-10-05T00:00:00.000Z', litres: 20, vehicleNumber: 'KA01AH6269' }],
  }, {
    dieselRecords: [{ date: '2026-10-06T00:00:00.000Z', litres: 30, vehicleNumber: 'KA01AH6269' }],
  }];

  expect(buildDieselVerificationRows(trips, '2026-10', uploads, 'KA01AH6269')[0].dieselFromDocument).toBe(50);
});

test('loads document records across months for each consecutive trip load-turn interval', () => {
  const trips = [{
    _id: 'previous-trip',
    createdAt: '2026-09-20T00:00:00.000Z',
    loadingDate: '2026-09-20T00:00:00.000Z',
    turnDate: '2026-09-28T00:00:00.000Z',
  }, {
    _id: 'current-trip',
    createdAt: '2026-10-01T00:00:00.000Z',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-12T00:00:00.000Z',
  }];

  expect(getDieselVerificationDateRange(trips, '2026-10', [{
    dieselRecords: [{ date: '2026-09-20T00:00:00.000Z', litres: 10 }],
  }])).toEqual({
    fromDate: '2026-09-28',
    toDate: '2026-10-12',
  });
  expect(getDieselVerificationDateRange(trips.slice(1), '2026-10')).toBeNull();
});

test('finds the previous trip by loading date even when trips were created out of order', () => {
  const trips = [{
    _id: 'current-trip',
    createdAt: '2026-10-01T00:00:00.000Z',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
  }, {
    _id: 'previous-trip',
    createdAt: '2026-10-05T00:00:00.000Z',
    loadingDate: '2026-09-20T00:00:00.000Z',
    turnDate: '2026-09-28T00:00:00.000Z',
  }];
  const uploads = [{
    dieselRecords: [
      { date: '2026-09-28T00:00:00.000Z', litres: 10 },
      { date: '2026-10-10T00:00:00.000Z', litres: 20 },
    ],
  }];

  expect(buildDieselVerificationRows(trips, '2026-10', uploads)[0].dieselFromDocument).toBe(30);
});

test('uses the earliest valid uploaded document date through the current trip turn for its first row', () => {
  const uploads = [{
    dieselRecords: [
      { date: null, litres: 500 },
      { date: '2026-09-20T00:00:00.000Z', litres: 10 },
      { date: '2026-10-10T00:00:00.000Z', litres: 20 },
      { date: '2026-10-11T00:00:00.000Z', litres: 100 },
    ],
  }];
  const trips = [{
    _id: 'first-trip',
    loadingDate: '2026-10-01T00:00:00.000Z',
    turnDate: '2026-10-10T00:00:00.000Z',
  }];

  expect(getDieselVerificationDateRange(trips, '2026-10', uploads)).toEqual({
    fromDate: '2026-09-20',
    toDate: '2026-10-10',
  });
  expect(buildDieselVerificationRows(trips, '2026-10', uploads)[0].dieselFromDocument).toBe(30);
});

test('formats verification dates and litres for the table', () => {
  expect(formatVerificationDate('2026-09-01T00:00:00.000Z')).not.toBe('—');
  expect(formatVerificationDate(null)).toBe('—');
  expect(formatVerificationLitres(12.5)).toContain('12.5');
  expect(formatVerificationLitres(null)).toBe('—');
  expect(formatVerificationKilometres(1234.5)).toContain('1,234.5 km');
  expect(formatVerificationKilometres(null)).toBe('—');
  expect(formatVerificationMileage(3.25)).toBe('3.25 km/L');
  expect(formatVerificationMileage(null)).toBe('—');
});
