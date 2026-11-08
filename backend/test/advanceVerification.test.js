const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const XLSX = require('@e965/xlsx');
const PDFDocument = require('pdfkit');
const AdvanceVerification = require('../src/models/AdvanceVerification');
const Vehicle = require('../src/models/Vehicle');
const { parseAdvanceRecords } = require('../src/utils/advanceVerification');

async function workbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Advance Statement');
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function pdfBuffer(lines) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument();
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    lines.forEach((line) => document.text(line));
    document.end();
  });
}

function response() {
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

test('parses CSV and Excel advance statements with optional vehicle numbers', async () => {
  const expected = [
    { date: new Date('2026-10-10T00:00:00.000Z'), amount: 1250.25, vehicleNumber: '6269' },
    { date: new Date('2026-10-11T00:00:00.000Z'), amount: 500, vehicleNumber: '6269' },
    { date: new Date('2026-10-12T00:00:00.000Z'), amount: 75, vehicleNumber: '1234' },
  ];
  const csv = Buffer.from(
    '\uFEFFDate,Amount,Vehicle Number\n'
    + '10/10/2026,"₹1,250.25",6269\n'
    + '11-Oct-2026,500,\n'
    + '12/10/2026,75,1234\n'
  );
  const workbook = await workbookBuffer([
    ['Txn Date', 'Advance Amount', 'Vehicle No'],
    ['10/10/2026', '1,250.25', 'KA01AH6269'],
    ['11-Oct-2026', 500, ''],
    ['12/10/2026', 75, 'KA02AB1234'],
  ]);

  assert.deepEqual(await parseAdvanceRecords(csv, 'csv', 'KA01AH6269'), expected);
  assert.deepEqual(await parseAdvanceRecords(workbook, 'xlsx', 'KA01AH6269'), expected);
});

test('parses selectable-text PDF full and numeric vehicle suffixes before amounts', async () => {
  const pdf = await pdfBuffer([
    'Transaction Date Vehicle Number Amount',
    '10-Nov-2026 KA01AH6269 1,250.50',
    '11-Nov-2026 6304 750.00',
  ]);
  assert.deepEqual(await parseAdvanceRecords(pdf, 'pdf', 'KA03CD5678'), [
    {
      date: new Date('2026-11-10T00:00:00.000Z'),
      amount: 1250.5,
      vehicleNumber: '6269',
    },
    {
      date: new Date('2026-11-11T00:00:00.000Z'),
      amount: 750,
      vehicleNumber: '6304',
    },
  ]);

  const amountBeforeVehicle = await pdfBuffer([
    'Transaction Date Amount Vehicle Number',
    '12-Nov-2026 4,500.00 6269',
  ]);
  assert.deepEqual(await parseAdvanceRecords(amountBeforeVehicle, 'pdf', 'KA03CD5678'), [{
    date: new Date('2026-11-12T00:00:00.000Z'),
    amount: 4500,
    vehicleNumber: '6269',
  }]);
});

test('parses legacy .xls advance statements', async () => {
  const workbook = {
    SheetNames: ['Advance Statement'],
    Sheets: {
      'Advance Statement': XLSX.utils.aoa_to_sheet([
        ['Txn Date', 'Advance Amount', 'Vehicle No'],
        ['10/10/2026', '1,250.25', 'KA01AH6269'],
        ['11/10/2026', 500, ''],
      ]),
    },
  };
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });

  assert.deepEqual(await parseAdvanceRecords(buffer, 'xls', 'KA01AH6269'), [
    { date: new Date('2026-10-10T00:00:00.000Z'), amount: 1250.25, vehicleNumber: '6269' },
    { date: new Date('2026-10-11T00:00:00.000Z'), amount: 500, vehicleNumber: '6269' },
  ]);
});

test('rejects statements without Date and Amount columns and negative advance amounts', async () => {
  await assert.rejects(
    parseAdvanceRecords(Buffer.from('Date,Quantity\n10/10/2026,50\n'), 'csv'),
    /columns named "Date" and "Amount"/
  );
  await assert.rejects(
    parseAdvanceRecords(Buffer.from('Date,Amount\n10/10/2026,-50\n'), 'csv'),
    /non-negative Amount/
  );
});

test('lists advance uploads filtered by record date and authorized vehicle', async (t) => {
  const originals = { find: AdvanceVerification.find, findById: Vehicle.findById };
  const vehicleId = '507f1f77bcf86cd799439011';
  let query;
  const upload = {
    _id: 'upload-1',
    toObject() {
      return { _id: this._id, fileHash: 'private-hash', fileData: Buffer.from('private') };
    },
  };
  AdvanceVerification.find = (filter) => {
    query = filter;
    return {
      populate() { return this; },
      sort: async () => [upload],
    };
  };
  Vehicle.findById = () => ({
    select: async () => ({
      _id: vehicleId,
      customer: '507f1f77bcf86cd799439012',
    }),
  });
  t.after(() => {
    AdvanceVerification.find = originals.find;
    Vehicle.findById = originals.findById;
  });

  const result = response();
  const { listAdvanceVerifications } = require('../src/controllers/advanceVerificationController');
  await listAdvanceVerifications({
    query: { vehicleId, fromDate: '2026-10-01', toDate: '2026-10-31' },
    user: { role: 'super_admin' },
  }, result);

  assert.equal(result.statusCode, 200);
  assert.equal(String(query.customer), '507f1f77bcf86cd799439012');
  assert.deepEqual(query.advanceRecords.$elemMatch.date, {
    $gte: new Date('2026-10-01T00:00:00.000Z'),
    $lte: new Date('2026-10-31T00:00:00.000Z'),
  });
  assert.equal(result.body.uploads[0].fileHash, undefined);
  assert.equal(result.body.uploads[0].fileData, undefined);
});

test('creates an advance verification upload and rejects a duplicate file', async (t) => {
  const originals = {
    findOne: AdvanceVerification.findOne,
    create: AdvanceVerification.create,
    findById: Vehicle.findById,
  };
  const vehicleId = '507f1f77bcf86cd799439011';
  const customerId = '507f1f77bcf86cd799439012';
  const legacyWorkbook = {
    SheetNames: ['Advances'],
    Sheets: {
      Advances: XLSX.utils.aoa_to_sheet([['Date', 'Amount'], ['10/10/2026', 500]]),
    },
  };
  const buffer = XLSX.write(legacyWorkbook, { type: 'buffer', bookType: 'xls' });
  let savedUpload;
  AdvanceVerification.findOne = async () => null;
  Vehicle.findById = () => ({
    select: async () => ({
      _id: vehicleId,
      customer: customerId,
      vehicleNumber: 'KA01AH6269',
    }),
  });
  AdvanceVerification.create = async (upload) => {
    savedUpload = upload;
    return { toObject: () => ({ ...upload, _id: 'new-upload' }) };
  };
  t.after(() => {
    AdvanceVerification.findOne = originals.findOne;
    AdvanceVerification.create = originals.create;
    Vehicle.findById = originals.findById;
  });

  const { createAdvanceVerification } = require('../src/controllers/advanceVerificationController');
  const created = response();
  await createAdvanceVerification({
    body: { vehicleId, month: '2026-10' },
    file: { originalname: 'advances.xls', buffer },
    user: { role: 'super_admin', id: 'user-id' },
  }, created);
  assert.equal(created.statusCode, 201);
  assert.deepEqual(savedUpload.advanceRecords, [{
    date: new Date('2026-10-10T00:00:00.000Z'),
    amount: 500,
    vehicleNumber: '6269',
  }]);
  assert.equal(savedUpload.contentType, 'application/vnd.ms-excel');

  AdvanceVerification.findOne = async () => ({ _id: 'existing-upload' });
  const duplicate = response();
  await createAdvanceVerification({
    body: { vehicleId, month: '2026-10' },
    file: { originalname: 'advances.xls', buffer },
    user: { role: 'super_admin', id: 'user-id' },
  }, duplicate);
  assert.equal(duplicate.statusCode, 409);
  assert.match(duplicate.body.error, /exact statement file has already been uploaded/);
});
