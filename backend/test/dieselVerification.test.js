const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { parseDieselRecords } = require('../src/utils/dieselVerification');

async function workbookBuffer(rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Diesel Statement');
  rows.forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

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

test('reports missing headers and invalid row values', async () => {
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Amount'], ['2026-09-10', 10]])),
    /columns named "Date" and "Diesel \(litres\)"/
  );
  await assert.rejects(
    parseDieselRecords(await workbookBuffer([['Date', 'Diesel (litres)'], ['invalid', 10]])),
    /Row 2.*valid Date/
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
  await assert.rejects(
    parseDieselRecords(Buffer.from('Date,Diesel (litres)\n2026-09-10,-1\n'), 'csv'),
    /Row 2.*non-negative/
  );
});
