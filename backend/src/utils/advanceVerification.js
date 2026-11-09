const { PDFParse } = require('pdf-parse');
const { Readable } = require('stream');
const { parseDate, getVehicleNumber } = require('./dieselVerification');
const { loadSpreadsheetWorkbook } = require('./spreadsheet');

function getLastFourVehicleDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

function normalizeMobileNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
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
    let debitColumn = 0;
    let vehicleColumn = 0;
    let driverMobileColumn = 0;
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
        'debit',
        'debitamount',
        'debitvalue',
        'withdrawal',
        'withdrawalamount',
        'withdrawalvalue',
      ].includes(header)) debitColumn = columnNumber;
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
      if ([
        'mobile',
        'mobileno',
        'mobilenumber',
        'drivermobile',
        'drivermobileno',
        'drivermobilenumber',
        'driverphone',
        'drivernumber',
        'phonenumber',
      ].includes(header)) driverMobileColumn = columnNumber;
    });
    if (dateColumn && (debitColumn || amountColumn)) {
      return {
        rowNumber,
        dateColumn,
        amountColumn: debitColumn || amountColumn,
        debitColumn: Boolean(debitColumn),
        vehicleColumn,
        driverMobileColumn,
      };
    }
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

function findPdfMobileValue(values, isAfterAmount) {
  const completeNumbers = values.filter((value) => /^\d{10,12}$/.test(value[0].replace(/\D/g, '')));
  if (completeNumbers.length) {
    const match = completeNumbers[isAfterAmount ? completeNumbers.length - 1 : 0];
    return { value: match[0], matches: [match] };
  }

  const orderedValues = isAfterAmount ? [...values].reverse() : values;
  const mobileParts = [];
  let digitCount = 0;
  for (const value of orderedValues) {
    if (!/^\d+$/.test(value[0])) break;
    mobileParts.push(value);
    digitCount += value[0].length;
    if (digitCount >= 10) {
      if (digitCount <= 12) {
        const matches = isAfterAmount ? mobileParts : [...mobileParts].reverse();
        const value = [...matches]
          .sort((a, b) => a.index - b.index)
          .map((part) => part[0])
          .join('');
        return { value, matches };
      }
      break;
    }
  }
  return null;
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
    const driverMobileNumber = header.driverMobileColumn
      ? normalizeMobileNumber(getCellValue(row.getCell(header.driverMobileColumn)))
      : '';
    if ((dateValue == null || dateValue === '') && (amountValue == null || amountValue === '')) continue;
    if (header.debitColumn && (amountValue == null || String(amountValue).trim() === '')) continue;

    const date = parseDate(dateValue);
    if (!date) continue;
    if (amountValue == null || String(amountValue).trim() === '') {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Amount value.`);
    }
    records.push({
      date,
      amount: parseAmount(amountValue, `Row ${rowNumber} in "${worksheet.name}"`),
      ...(rowVehicleNumber || !driverMobileNumber
        ? { vehicleNumber: rowVehicleNumber || getLastFourVehicleDigits(targetVehicleNumber) }
        : {}),
      ...(driverMobileNumber ? { driverMobileNumber } : {}),
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
  const hasValueHeader = ['amount', 'debit', 'withdrawal'].some((header) => normalizedHeaders.includes(header));
  if (!normalizedHeaders.includes('date') || !hasValueHeader) {
    throw new Error('The PDF must contain selectable text with a Date and Amount, Debit, or Withdrawal column.');
  }
  const vehicleHeaderPosition = Math.max(
    normalizedHeaders.indexOf('vehiclenumber'),
    normalizedHeaders.indexOf('vehicleno'),
    normalizedHeaders.indexOf('vehicle')
  );
  const valueHeaderPosition = Math.max(
    normalizedHeaders.indexOf('debit'),
    normalizedHeaders.indexOf('debitamount'),
    normalizedHeaders.indexOf('withdrawal'),
    normalizedHeaders.indexOf('withdrawalamount'),
    normalizedHeaders.indexOf('amount')
  );
  const vehicleIsAfterAmount = vehicleHeaderPosition > valueHeaderPosition;
  const driverMobileHeaderPosition = Math.max(
    normalizedHeaders.indexOf('drivermobilenumber'),
    normalizedHeaders.indexOf('drivermobileno'),
    normalizedHeaders.indexOf('drivermobile'),
    normalizedHeaders.indexOf('mobilenumber'),
    normalizedHeaders.indexOf('mobileno'),
    normalizedHeaders.indexOf('mobile'),
    normalizedHeaders.indexOf('driverphone'),
    normalizedHeaders.indexOf('drivernumber'),
    normalizedHeaders.indexOf('phonenumber')
  );
  const driverMobileIsAfterAmount = driverMobileHeaderPosition > valueHeaderPosition;

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
    let transactionText = line
      .slice(dateMatch.index + dateMatch[0].length)
      .replace(/\b[A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4}\b/ig, '');
    let values = [...transactionText.matchAll(numberPattern)];
    let driverMobileNumber = '';
    if (driverMobileHeaderPosition >= 0) {
      const mobile = findPdfMobileValue(values, driverMobileIsAfterAmount);
      if (mobile) {
        driverMobileNumber = normalizeMobileNumber(mobile.value);
        mobile.matches
          .sort((a, b) => b.index - a.index)
          .forEach((match) => {
            transactionText = transactionText.slice(0, match.index)
              + transactionText.slice(match.index + match[0].length);
          });
        values = [...transactionText.matchAll(numberPattern)];
      }
    }
    let numericVehicleNumber = '';
    if (!fullVehicleNumber && vehicleHeaderPosition >= 0) {
      const vehicleValue = vehicleIsAfterAmount ? values.at(-1) : values[0];
      if (vehicleValue?.[0].match(/^\d{4}$/)) {
        numericVehicleNumber = vehicleValue[0];
        transactionText = transactionText.slice(0, vehicleValue.index)
          + transactionText.slice(vehicleValue.index + vehicleValue[0].length);
        values = [...transactionText.matchAll(numberPattern)];
      }
    }
    const amountText = values.at(-1)?.[0];
    if (amountText == null) {
      throw new Error(`PDF row ${index + 1} needs a non-negative Amount value.`);
    }
    const vehicleNumber = getLastFourVehicleDigits(fullVehicleNumber)
      || numericVehicleNumber
      || (!driverMobileNumber && defaultVehicleNumber);
    records.push({
      date,
      amount: parseAmount(amountText, `PDF row ${index + 1}`),
      ...(vehicleNumber ? { vehicleNumber } : {}),
      ...(driverMobileNumber ? { driverMobileNumber } : {}),
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
      throw new Error('The CSV must contain a Date column and an Amount, Debit, or Withdrawal column.');
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
    throw new Error('The workbook must contain a Date column and an Amount, Debit, or Withdrawal column.');
  }
  if (!records.length) throw new Error('No dated advance records were found in the workbook.');
  return records;
}

module.exports = { parseAdvanceRecords };
