const test = require('node:test');
const assert = require('node:assert/strict');
const DieselVerification = require('../src/models/DieselVerification');
const Vehicle = require('../src/models/Vehicle');
const { listDieselVerifications } = require('../src/controllers/dieselVerificationController');

test('filters uploaded statements by their diesel record dates and selected vehicle', async (t) => {
  const originalFind = DieselVerification.find;
  const originalVehicleFindById = Vehicle.findById;
  const vehicleId = '507f1f77bcf86cd799439011';
  let query;
  let migratedRecords;
  const legacyUpload = {
    _id: 'upload-1',
    contentType: 'text/csv',
    fileData: Buffer.from('Date,Diesel (litres)\n10/10/2026,20\n'),
    recordsParserVersion: 0,
    dieselRecords: [],
    async save() {},
    toObject() {
      return {
        _id: this._id,
        dieselRecords: this.dieselRecords,
        recordsParserVersion: this.recordsParserVersion,
      };
    },
  };
  DieselVerification.find = (filter) => {
    if (filter.$or) {
      return {
        select() { return this; },
        sort: async () => [legacyUpload],
      };
    }
    query = filter;
    return {
      sort: async () => {
        migratedRecords = legacyUpload.dieselRecords;
        return [legacyUpload];
      },
    };
  };
  Vehicle.findById = () => ({
    select: async () => ({
      _id: vehicleId,
      customer: '507f1f77bcf86cd799439012',
      vehicleNumber: 'KA01AH6269',
    }),
  });
  t.after(() => {
    DieselVerification.find = originalFind;
    Vehicle.findById = originalVehicleFindById;
  });

  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await listDieselVerifications({
    query: { vehicleId, fromDate: '2026-10-01', toDate: '2026-10-15' },
    user: { role: 'super_admin' },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(String(query.vehicle), vehicleId);
  assert.deepEqual(query.dieselRecords.$elemMatch.date, {
    $gte: new Date('2026-10-01T00:00:00.000Z'),
    $lte: new Date('2026-10-15T00:00:00.000Z'),
  });
  assert.equal(response.body.uploads[0]._id, 'upload-1');
  assert.deepEqual(migratedRecords, [{ date: new Date('2026-10-10T00:00:00.000Z'), litres: 20 }]);
  assert.equal(legacyUpload.recordsParserVersion, 1);
  assert.equal(response.body.uploads[0].recordsParserVersion, undefined);
});

test('rejects invalid uploaded-statement date ranges', async () => {
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  await listDieselVerifications({
    query: {
      vehicleId: '507f1f77bcf86cd799439011',
      fromDate: '2026-10-16',
      toDate: '2026-10-15',
    },
    user: { role: 'super_admin' },
  }, response);

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /fromDate and toDate must be valid dates/);
});
