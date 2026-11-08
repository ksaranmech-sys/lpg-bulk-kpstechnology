const { PDFParse } = require('pdf-parse');
const { Readable } = require('stream');
const { parseDate, getVehicleNumber } = require('./dieselVerification');
const { loadSpreadsheetWorkbook } = require('./spreadsheet');

function getLastFourVehicleDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getCellValue(cell) {
  const value = cell.value;
  return value && typeof value === 'object' && !(value instanceof Date) && 'result' in value
    ? value.result
    : value;
}

function findHeader(worksheet) {
  const maxRow = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    let dateColumn = 0;
    let amountColumn = 0;
    let vehicleColumn = 0;
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = normalizeHeader(getCellValue(cell));
      if ([
        'date',
        'settlementdate',
        'settlementdatetime',
        'transactiondate',
        'transactiondatetime',
        'transactiontimestamp',
        'txndate',
        'txndatetime',
        'txntimestamp',
        'postingdate',
        'dateandtime',
      ].includes(header)) dateColumn = columnNumber;
      if ([
        'amount',
        'advance',
        'advanceamount',
        'transactionamount',
        'creditedamount',
        'creditamount',
        'transferamount',
        'paidamount',
      ].includes(header)) amountColumn = columnNumber;
      if ([
        'vehicle',
        'vehicleno',
        'vehiclenumber',
        'vehicleregistration',
        'registrationno',
        'registrationnumber',
        'regno',
        'truckno',
        'trucknumber',
      ].includes(header)) vehicleColumn = columnNumber;
    });
    if (dateColumn && amountColumn) return { rowNumber, dateColumn, amountColumn, vehicleColumn };
  }
  return null;
}

function parseAmount(value, rowDescription) {
  const text = typeof value === 'string'
    ? value.replace(/,/g, '').replace(/₹|rs\.?/gi, '').trim()
    : value;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${rowDescription} needs a non-negative Amount value.`);
  }
  return amount;
}

function parseWorksheetRecords(worksheet, targetVehicleNumber) {
  const records = [];
  const header = findHeader(worksheet);
  if (!header) return { foundHeaders: false, records };

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const dateValue = getCellValue(row.getCell(header.dateColumn));
    const amountValue = getCellValue(row.getCell(header.amountColumn));
    const rowVehicleNumber = header.vehicleColumn
      ? getLastFourVehicleDigits(getCellValue(row.getCell(header.vehicleColumn)))
      : '';
    if ((dateValue == null || dateValue === '') && (amountValue == null || amountValue === '')) continue;

    const date = parseDate(dateValue);
    if (!date) continue;
    if (amountValue == null || String(amountValue).trim() === '') {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Amount value.`);
    }
    records.push({
      date,
      amount: parseAmount(amountValue, `Row ${rowNumber} in "${worksheet.name}"`),
      vehicleNumber: rowVehicleNumber || getLastFourVehicleDigits(targetVehicleNumber),
    });
  }
  return { foundHeaders: true, records };
}

async function parsePdfRecords(buffer, targetVehicleNumber) {
  const parser = new PDFParse({ data: buffer });
  let text;
  try {
    ({ text } = await parser.getText());
  } catch (error) {
    throw new Error('The PDF could not be read. Upload a valid PDF with selectable text.');
  } finally {
    await parser.destroy();
  }

  const lines = String(text || '').replace(/\u00a0/g, ' ').split(/\r?\n/);
  const normalizedHeaders = normalizeHeader(lines.slice(0, 40).join(' '));
  if (!normalizedHeaders.includes('date') || !normalizedHeaders.includes('amount')) {
    throw new Error('The PDF must contain selectable text with Date and Amount columns.');
  }

  const datePattern = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i;
  const numberPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
  const records = [];
  const defaultVehicleNumber = getLastFourVehicleDigits(targetVehicleNumber);

  lines.forEach((line, index) => {
    const dateMatch = datePattern.exec(line);
    datePattern.lastIndex = 0;
    if (!dateMatch) return;
    const date = parseDate(dateMatch[0]);
    if (!date) return;

    const fullVehicleNumber = getVehicleNumber(line);
    const transactionText = line
      .slice(dateMatch.index + dateMatch[0].length)
      .replace(/\b[A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4}\b/ig, '');
    const values = [...transactionText.matchAll(numberPattern)];
    const amountText = values.at(-1)?.[0];
    if (amountText == null) {
      throw new Error(`PDF row ${index + 1} needs a non-negative Amount value.`);
    }
    const numericVehicleNumber = values
      .slice(0, -1)
      .map(([value]) => getLastFourVehicleDigits(value))
      .find((value) => value.length === 4);
    records.push({
      date,
      amount: parseAmount(amountText, `PDF row ${index + 1}`),
      vehicleNumber: getLastFourVehicleDigits(fullVehicleNumber)
        || numericVehicleNumber
        || defaultVehicleNumber,
    });
  });

  if (!records.length) throw new Error('No dated advance records were found in the PDF.');
  return records;
}

async function parseAdvanceRecords(buffer, format = 'xlsx', targetVehicleNumber = '') {
  if (format === 'pdf') return parsePdfRecords(buffer, targetVehicleNumber);

  if (format === 'csv') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = await workbook.csv.read(Readable.from([buffer]), {
      dateFormats: [],
      parserOptions: { delimiter: ',', ignoreEmpty: true, trim: true },
    });
    const result = parseWorksheetRecords(worksheet, targetVehicleNumber);
    if (!result.foundHeaders) {
      throw new Error('The CSV must contain columns named "Date" and "Amount".');
    }
    if (!result.records.length) throw new Error('No dated advance records were found in the CSV.');
    return result.records;
  }

  if (!['xls', 'xlsx'].includes(format)) {
    throw new Error('Only PDF, CSV, and Excel (.xls/.xlsx) files can be processed.');
  }
  const workbook = await loadSpreadsheetWorkbook(buffer, format);
  const records = [];
  let hasExpectedHeaders = false;
  workbook.worksheets.forEach((worksheet) => {
    const result = parseWorksheetRecords(worksheet, targetVehicleNumber);
    hasExpectedHeaders ||= result.foundHeaders;
    records.push(...result.records);
  });
  if (!hasExpectedHeaders) {
    throw new Error('The workbook must contain columns named "Date" and "Amount".');
  }
  if (!records.length) throw new Error('No dated advance records were found in the workbook.');
  return records;
}

module.exports = { parseAdvanceRecords };
