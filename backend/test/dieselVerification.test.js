const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { parseDieselRecords } = require('../src/utils/dieselVerification');

async function workbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Diesel Statement');
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

test('parses selectable-text PDF diesel statements', async () => {
  const buffer = await pdfBuffer([
    'Txn Date        Diesel Quantity (L)',
    '10-Nov-2026 14:30        18.75',
    '11-Nov-2026 09:00        1,250.25',
  ]);

  const records = await parseDieselRecords(buffer, 'pdf');
  assert.deepEqual(records, [
    { date: new Date('2026-11-10T00:00:00.000Z'), litres: 18.75 },
    { date: new Date('2026-11-11T00:00:00.000Z'), litres: 1250.25 },
  ]);
});

test('parses ISO year-first dates in selectable-text PDF diesel statements', async () => {
  const buffer = await pdfBuffer([
    'Transaction Date        Diesel Quantity (L)',
    '2026-10-20        18.75',
    '2026/10/21        25.5',
    '22/10/26        30',
  ]);

  const records = await parseDieselRecords(buffer, 'pdf');
  assert.deepEqual(records, [
    { date: new Date('2026-10-20T00:00:00.000Z'), litres: 18.75 },
    { date: new Date('2026-10-21T00:00:00.000Z'), litres: 25.5 },
    { date: new Date('2026-10-22T00:00:00.000Z'), litres: 30 },
  ]);
});

test('parses multi-line PDF diesel transactions for all vehicles in the statement', async () => {
  const buffer = await pdfBuffer([
    'Transaction Date Vehicle No Diesel Quantity',
    '7135016158340033 KA01AH6269 1408744200 29/10/2026',
    "07:38:40 Sale 'DIESEL, CCMS 98.00 301.87 29583.00",
    '29/10/2026 07:38:13 - 0 Offline',
    '10 4000400001 OTHER VEHICLE',
    '7135016158999999 KA02AB1234 1408744201 29/10/2026',
    "08:00:00 Sale 'DIESEL, CCMS 100.00 500.00 50000.00",
  ]);

  assert.deepEqual(await parseDieselRecords(buffer, 'pdf', 'KA01AH6269'), [
    { date: new Date('2026-10-29T00:00:00.000Z'), litres: 301.87, vehicleNumber: 'KA01AH6269' },
    { date: new Date('2026-10-29T00:00:00.000Z'), litres: 500, vehicleNumber: 'KA02AB1234' },
  ]);
});

test('parses vehicle-specific spreadsheet records and assigns rows without a vehicle to upload selection', async () => {
  const buffer = await workbookBuffer([
    ['Date', 'Diesel Quantity', 'Vehicle No'],
    ['10/10/2026', 20, 'KA01AH6269'],
    ['10/10/2026', 30, 'KA02AB1234'],
    ['11/10/2026', 15, ''],
  ]);

  assert.deepEqual(await parseDieselRecords(buffer, 'xlsx', 'KA01AH6269'), [
    { date: new Date('2026-10-10T00:00:00.000Z'), litres: 20, vehicleNumber: 'KA01AH6269' },
    { date: new Date('2026-10-10T00:00:00.000Z'), litres: 30, vehicleNumber: 'KA02AB1234' },
    { date: new Date('2026-10-11T00:00:00.000Z'), litres: 15, vehicleNumber: 'KA01AH6269' },
  ]);
});

test('parses vendor diesel statement dates and litre values', async () => {
  const buffer = await workbookBuffer([
    ['Date', 'Diesel (litres)'],
    [new Date('2026-09-10T00:00:00.000Z'), 125.5],
    ['11/09/2026', '1,250.25'],
  ]);

  const records = await parseDieselRecords(buffer);
  assert.deepEqual(records, [
    { date: new Date('2026-09-10T00:00:00.000Z'), litres: 125.5 },
    { date: new Date('2026-09-11T00:00:00.000Z'), litres: 1250.25 },
  ]);
});

test('parses CSV statements with quoted values, comma-formatted litres, and a UTF-8 header marker', async () => {
  const csv = '\uFEFFDate,Diesel (litres)\r\n10/09/2026,125.5\r\n11/09/2026,"1,250.25"\r\n';
  const records = await parseDieselRecords(Buffer.from(csv), 'csv');

  assert.deepEqual(records, [
    { date: new Date('2026-09-10T00:00:00.000Z'), litres: 125.5 },
    { date: new Date('2026-09-11T00:00:00.000Z'), litres: 1250.25 },
  ]);
});

test('parses vendor CSV transaction date and diesel quantity headers while ignoring time', async () => {
  const csv = 'Transaction Date,Diesel Quantity (L)\r\n10-Nov-2026 14:30,18.75\r\n';
  const records = await parseDieselRecords(Buffer.from(csv), 'csv');

  assert.deepEqual(records, [
    { date: new Date('2026-11-10T00:00:00.000Z'), litres: 18.75 },
  ]);
});

test('accepts Txn Date in Excel and CSV statements', async () => {
  const workbook = await workbookBuffer([
    ['Txn Date', 'Quantity'],
    ['10-Nov-2026 14:30', 18.75],
  ]);
  const csv = Buffer.from('Txn Date,Diesel Quantity (L)\r\n10-Nov-2026 14:30,18.75\r\n');
  const expected = [{ date: new Date('2026-11-10T00:00:00.000Z'), litres: 18.75 }];

  assert.deepEqual(await parseDieselRecords(workbook), expected);
  assert.deepEqual(await parseDieselRecords(csv, 'csv'), expected);
});

test('parses vendor dates with two-digit years and ignores 12-hour timestamps', async () => {
  const csv = 'Transaction Date,Diesel Quantity (L)\r\n10-Nov-26 02:30:45 PM,18.75\r\n';
  const records = await parseDieselRecords(Buffer.from(csv), 'csv');

  assert.deepEqual(records, [
    { date: new Date('2026-11-10T00:00:00.000Z'), litres: 18.75 },
  ]);
});

test('accepts Settlement Date and Quantity columns in Excel workbooks', async () => {
  const buffer = await workbookBuffer([
    ['Settlement Date', 'Quantity'],
    ['10/09/2026', '1,250.25'],
  ]);
  const records = await parseDieselRecords(buffer);

  assert.deepEqual(records, [
    { date: new Date('2026-09-10T00:00:00.000Z'), litres: 1250.25 },
  ]);
});

test('accepts settlement date and quantity aliases in CSV statements', async () => {
  const csv = 'Settlement Date,Quantity\r\n10/09/2026,"1,250.25"\r\n';
  const records = await parseDieselRecords(Buffer.from(csv), 'csv');

  assert.deepEqual(records, [
    { date: new Date('2026-09-10T00:00:00.000Z'), litres: 1250.25 },
  ]);
});

test('skips invalid dates and reports missing headers or invalid litres', async () => {
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Amount'], ['2026-09-10', 10]])),
    /columns named "Date" and "Diesel \(litres\)"/
  );
  const validDatedRecords = await parseDieselRecords(await workbookBuffer([
    ['Date', 'Diesel (litres)'],
    ['2026-09-10', 10],
    ['invalid', 200],
    ['2026-02-30', 300],
    [null, 400],
  ]));
  assert.deepEqual(validDatedRecords, [
    { date: new Date('2026-09-10T00:00:00.000Z'), litres: 10 },
  ]);
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Diesel (litres)'], ['invalid', 10]])),
    /No dated diesel records were found/
  );
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Diesel (litres)'], ['2026-09-10', -1]])),
    /Row 2.*non-negative/
  );
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Diesel (litres)'], ['2026-09-10', null]])),
    /Row 2.*non-negative/
  );
  await assert.rejects(
    parseDieselRecords(Buffer.from('Date,Amount\n2026-09-10,10\n'), 'csv'),
    /CSV must contain columns named "Date" and "Diesel \(litres\)"/
  );
  assert.deepEqual(
    await parseDieselRecords(Buffer.from('Date,Diesel (litres)\n2026-09-10,10\ninvalid,200\n'), 'csv'),
    [{ date: new Date('2026-09-10T00:00:00.000Z'), litres: 10 }]
  );
  await assert.rejects(
    parseDieselRecords(Buffer.from('Date,Diesel (litres)\n2026-09-10,-1\n'), 'csv'),
    /Row 2.*non-negative/
  );
  await assert.rejects(
    parseDieselRecords(Buffer.from('Date,Diesel (litres)\ninvalid,10\n'), 'csv'),
    /No dated diesel records were found/
  );
});
