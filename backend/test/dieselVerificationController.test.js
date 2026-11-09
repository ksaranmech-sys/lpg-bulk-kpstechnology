const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('@e965/xlsx');
const DieselVerification = require('../src/models/DieselVerification');
const Vehicle = require('../src/models/Vehicle');
const {
  listDieselVerifications,
  createDieselVerification,
} = require('../src/controllers/dieselVerificationController');

function createResponse() {
  return {
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
}

test('filters uploaded statements by their diesel record dates and selected vehicle', async (t) => {
  const originalFind = DieselVerification.find;
  const originalVehicleFindById = Vehicle.findById;
  const vehicleId = '507f1f77bcf86cd799439011';
  let query;
  let migratedRecords;
  const duplicateUpload = {
    _id: 'upload-duplicate',
    fileHash: require('crypto').createHash('sha256')
      .update(Buffer.from('Date,Diesel (litres)\n10/10/2026,20\n'))
      .digest('hex'),
    toObject() {
      return { _id: this._id, fileHash: this.fileHash };
    },
  };
  const legacyUpload = {
    _id: 'upload-1',
    contentType: 'text/csv',
    fileData: Buffer.from('Date,Diesel (litres)\n10/10/2026,20\n'),
    vehicle: { vehicleNumber: 'KA01AH6269' },
    recordsParserVersion: 0,
    dieselRecords: [],
    defRecords: [],
    async save() {},
    toObject() {
      return {
        _id: this._id,
        dieselRecords: this.dieselRecords,
        defRecords: this.defRecords,
        defAmountRecords: this.defAmountRecords,
        recordsParserVersion: this.recordsParserVersion,
      };
    },
  };
  DieselVerification.find = (filter) => {
    if (filter.$or?.[0]?.recordsParserVersion) {
      return {
        select() { return this; },
        populate() { return this; },
        sort: async () => [legacyUpload],
      };
    }
    query = filter;
    return {
      populate() { return this; },
      sort: async () => {
        query = filter;
        migratedRecords = legacyUpload.dieselRecords;
        return [legacyUpload, duplicateUpload];
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
  assert.equal(String(query.customer), '507f1f77bcf86cd799439012');
  assert.deepEqual(query.$or, [
    { dieselRecords: { $elemMatch: { date: {
      $gte: new Date('2026-10-01T00:00:00.000Z'),
      $lte: new Date('2026-10-15T00:00:00.000Z'),
    } } } },
    { defRecords: { $elemMatch: { date: {
      $gte: new Date('2026-10-01T00:00:00.000Z'),
      $lte: new Date('2026-10-15T00:00:00.000Z'),
    } } } },
    { defAmountRecords: { $elemMatch: { date: {
      $gte: new Date('2026-10-01T00:00:00.000Z'),
      $lte: new Date('2026-10-15T00:00:00.000Z'),
    } } } },
  ]);
  assert.deepEqual(migratedRecords, [{
    date: new Date('2026-10-10T00:00:00.000Z'),
    litres: 20,
    vehicleNumber: 'KA01AH6269',
  }]);
  assert.equal(legacyUpload.recordsParserVersion, 6);
  assert.deepEqual(legacyUpload.defRecords, []);
  assert.deepEqual(legacyUpload.defAmountRecords, []);
  assert.equal(response.body.uploads[0]._id, 'upload-1');
  assert.equal(response.body.uploads.length, 1);
  assert.equal(response.body.uploads[0].fileHash, undefined);
  assert.equal(response.body.uploads[0].recordsParserVersion, undefined);
});

test('lists customer statements and rejects exact duplicate file contents', async (t) => {
  const originals = {
    findOne: DieselVerification.findOne,
    create: DieselVerification.create,
    findById: Vehicle.findById,
  };
  const vehicleId = '507f1f77bcf86cd799439011';
  const customerId = '507f1f77bcf86cd799439012';
  const buffer = Buffer.from('Date,Diesel (litres)\n10/10/2026,20\n');
  const duplicate = { _id: 'existing-upload' };
  let duplicateFilter;
  DieselVerification.findOne = async (filter) => {
    duplicateFilter = filter;
    return duplicate;
  };
  Vehicle.findById = () => ({
    select: async () => ({ _id: vehicleId, customer: customerId, vehicleNumber: 'KA01AH6269' }),
  });
  DieselVerification.create = async () => {
    throw new Error('Duplicate file should not be saved again');
  };
  t.after(() => {
    DieselVerification.findOne = originals.findOne;
    DieselVerification.create = originals.create;
    Vehicle.findById = originals.findById;
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
  const { createDieselVerification } = require('../src/controllers/dieselVerificationController');
  await createDieselVerification({
    body: { vehicleId, month: '2026-10' },
    file: { originalname: 'statement.csv', buffer },
    user: { role: 'super_admin', id: 'user-id' },
  }, response);

  assert.equal(response.statusCode, 409);
  assert.equal(response.body.error, 'This exact statement file has already been uploaded for this customer.');
  assert.equal(String(duplicateFilter.customer), customerId);
  assert.equal(duplicateFilter.fileHash.length, 64);
});

test('uploads all vehicle rows and assigns rows without a vehicle number to the selected vehicle', async (t) => {
  const originals = {
    findOne: DieselVerification.findOne,
    create: DieselVerification.create,
    findById: Vehicle.findById,
  };
  const vehicleId = '507f1f77bcf86cd799439011';
  const customerId = '507f1f77bcf86cd799439012';
  let savedUpload;
  DieselVerification.findOne = async () => null;
  Vehicle.findById = () => ({
    select: async () => ({ _id: vehicleId, customer: customerId, vehicleNumber: 'KA01AH6269' }),
  });
  DieselVerification.create = async (upload) => {
    savedUpload = upload;
    return { toObject: () => ({ ...upload, _id: 'new-upload' }) };
  };
  t.after(() => {
    DieselVerification.findOne = originals.findOne;
    DieselVerification.create = originals.create;
    Vehicle.findById = originals.findById;
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
  const { createDieselVerification } = require('../src/controllers/dieselVerificationController');
  await createDieselVerification({
    body: { vehicleId, month: '2026-10' },
    file: {
      originalname: 'fleet.csv',
      buffer: Buffer.from(
        'Date,Diesel Quantity,DEF Quantity,Product,Amount,Vehicle No\n'
        + '10/10/2026,20,2,,,KA01AH6269\n'
        + '10/10/2026,30,3,,,KA02AB1234\n'
        + '11/10/2026,15,1,,,\n'
        + '12/10/2026,,,DEF,2190.32,KA01AH6269\n'
      ),
    },
    user: { role: 'super_admin', id: 'user-id' },
  }, response);

  assert.equal(response.statusCode, 201);
  assert.deepEqual(savedUpload.dieselRecords.map(({ litres, vehicleNumber }) => [litres, vehicleNumber]), [
    [20, 'KA01AH6269'],
    [30, 'KA02AB1234'],
    [15, 'KA01AH6269'],
  ]);
  assert.deepEqual(savedUpload.defRecords.map(({ litres, vehicleNumber }) => [litres, vehicleNumber]), [
    [2, 'KA01AH6269'],
    [3, 'KA02AB1234'],
    [1, 'KA01AH6269'],
  ]);
  assert.deepEqual(savedUpload.defAmountRecords.map(({ amount, vehicleNumber }) => [amount, vehicleNumber]), [
    [2190.32, 'KA01AH6269'],
  ]);
  assert.equal(savedUpload.fileHash.length, 64);
});

test('uploads legacy .xls diesel statements with the Excel MIME type', async (t) => {
  const originals = {
    findOne: DieselVerification.findOne,
    create: DieselVerification.create,
    findById: Vehicle.findById,
  };
  const vehicleId = '507f1f77bcf86cd799439011';
  const customerId = '507f1f77bcf86cd799439012';
  const workbook = {
    SheetNames: ['Diesel'],
    Sheets: {
      Diesel: XLSX.utils.aoa_to_sheet([['Date', 'Diesel Quantity'], ['10/10/2026', 20]]),
    },
  };
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
  let savedUpload;
  DieselVerification.findOne = async () => null;
  Vehicle.findById = () => ({
    select: async () => ({ _id: vehicleId, customer: customerId, vehicleNumber: 'KA01AH6269' }),
  });
  DieselVerification.create = async (upload) => {
    savedUpload = upload;
    return { toObject: () => ({ ...upload, _id: 'new-upload' }) };
  };
  t.after(() => {
    DieselVerification.findOne = originals.findOne;
    DieselVerification.create = originals.create;
    Vehicle.findById = originals.findById;
  });

  const result = createResponse();
  await createDieselVerification({
    body: { vehicleId, month: '2026-10' },
    file: { originalname: 'diesel.xls', buffer },
    user: { role: 'super_admin', id: 'user-id' },
  }, result);

  assert.equal(result.statusCode, 201);
  assert.equal(savedUpload.contentType, 'application/vnd.ms-excel');
  assert.deepEqual(savedUpload.dieselRecords.map(({ litres }) => litres), [20]);
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
