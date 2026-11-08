const { PDFParse } = require('pdf-parse');
const { Readable } = require('stream');
const { loadSpreadsheetWorkbook } = require('./spreadsheet');

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildUtcDate(year, month, day) {
  const date = new Date(Date.UTC(year, month, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month
    || date.getUTCDate() !== day
  ) return null;
  return date;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 2958465) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
  }
  const text = String(value || '').trim();
  const isoDate = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?\s*(AM|PM)?)?$/i);
  if (isoDate) {
    const [, yearText, monthText, dayText] = isoDate;
    return buildUtcDate(Number(yearText), Number(monthText) - 1, Number(dayText));
  }
  const localDate = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (localDate) {
    const [, dayText, monthText, yearText] = localDate;
    const year = Number(yearText.length === 2 ? `20${yearText}` : yearText);
    return buildUtcDate(year, Number(monthText) - 1, Number(dayText));
  }
  const namedMonthDate = text.match(/^(\d{1,2})[- /]([a-z]{3,})[- /](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (namedMonthDate) {
    const [, dayText, monthText, rawYearText] = namedMonthDate;
    const month = new Date(`${monthText.slice(0, 3)} 1, 2000`).getMonth();
    const year = Number(rawYearText.length === 2 ? `20${rawYearText}` : rawYearText);
    if (!Number.isFinite(month)) return null;
    return buildUtcDate(year, month, Number(dayText));
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCellValue(cell) {
  const value = cell.value;
  return value && typeof value === 'object' && !(value instanceof Date) && 'result' in value
    ? value.result
    : value;
}

function normalizeVehicleNumber(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function getVehicleNumber(value) {
  const match = String(value || '').toUpperCase().match(/\b[A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4}\b/);
  return match ? normalizeVehicleNumber(match[0]) : '';
}

function findHeader(worksheet, allowCsvHeaders = false) {
  const maxRow = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let dateColumn = 0;
    let litresColumn = 0;
    let vehicleColumn = 0;
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = normalizeHeader(getCellValue(cell));
      if (
        [
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
        ].includes(header)
      ) dateColumn = columnNumber;
      if (
        ['diesellitres', 'diesellitre', 'quantity', 'qty', 'volume', 'dieselquantity', 'dieselqty'].includes(header)
        || (allowCsvHeaders && (
          ['litres', 'litre', 'liters', 'liter', 'quantitylitres', 'quantityliters'].includes(header)
          || (header.includes('diesel') && /(litre|liter|ltr|qty|quantity|volume)/.test(header))
        ))
      ) litresColumn = columnNumber;
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
      ].includes(header)) {
        vehicleColumn = columnNumber;
      }
    });
    if (dateColumn && litresColumn) return { rowNumber, dateColumn, litresColumn, vehicleColumn };
  }
  return null;
}

function parseWorksheetRecords(worksheet, allowCsvHeaders = false, targetVehicleNumber = '') {
  const records = [];
  const header = findHeader(worksheet, allowCsvHeaders);
  if (!header) return { foundHeaders: false, records };
  const normalizedTargetVehicle = normalizeVehicleNumber(targetVehicleNumber);

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const dateValue = getCellValue(row.getCell(header.dateColumn));
    const litresValue = getCellValue(row.getCell(header.litresColumn));
    const rowVehicleNumber = header.vehicleColumn
      ? normalizeVehicleNumber(getCellValue(row.getCell(header.vehicleColumn)))
      : '';
    if ((dateValue == null || dateValue === '') && (litresValue == null || litresValue === '')) continue;

    const date = parseDate(dateValue);
    if (!date) continue;
    if (litresValue == null || String(litresValue).trim() === '') {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Diesel (litres) value.`);
    }
    const litresText = typeof litresValue === 'string' ? litresValue.replace(/,/g, '').trim() : litresValue;
    const litres = Number(litresText);
    if (!Number.isFinite(litres) || litres < 0) {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Diesel (litres) value.`);
    }
    const vehicleNumber = rowVehicleNumber || normalizedTargetVehicle;
    records.push({
      date,
      litres,
      ...(vehicleNumber ? { vehicleNumber } : {}),
    });
  }
  return { foundHeaders: true, records };
}

async function parseDieselRecords(buffer, format = 'xlsx', targetVehicleNumber = '') {
  if (format === 'pdf') {
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
    const hasDateHeader = normalizedHeaders.includes('date');
    const hasQuantityHeader = /diesel(litres?|liters?|quantity|qty|volume)|quantity(litres?|liters?|qty)?|litres?|liters?|qty/.test(normalizedHeaders);
    if (!text || !hasDateHeader || !hasQuantityHeader) {
      throw new Error('The PDF must contain selectable text with Date and Diesel Quantity (litres) columns.');
    }

    const datePattern = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i;
    const numberPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
    const dieselVolumePattern = /DIESEL\s*,?\s*CCMS\s+[\d,]+(?:\.\d+)?\s+([\d,]+(?:\.\d+)?)/i;
    const defaultVehicleNumber = normalizeVehicleNumber(targetVehicleNumber);
    const records = [];

    lines.forEach((line, index) => {
      if (/\boffline\b/i.test(line)) return;
      const dateMatch = datePattern.exec(line);
      datePattern.lastIndex = 0;
      if (!dateMatch) return;

      const date = parseDate(dateMatch[0]);
      if (!date) return;
      const transactionLines = [line];
      for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 6); nextIndex += 1) {
        if (datePattern.test(lines[nextIndex]) || /^\d+\s+\d{10}\b/.test(lines[nextIndex])) break;
        transactionLines.push(lines[nextIndex]);
      }
      const transactionText = transactionLines.join(' ');
      const dieselMatch = transactionText.match(dieselVolumePattern);
      let litresText = dieselMatch?.[1];
      if (litresText == null) {
        const values = [...line.slice(dateMatch.index + dateMatch[0].length).matchAll(numberPattern)];
        litresText = values.at(-1)?.[0];
      }
      if (litresText == null) return;

      const litres = Number(litresText.replace(/,/g, ''));
      if (!Number.isFinite(litres) || litres < 0) {
        throw new Error(`PDF row ${index + 1} needs a non-negative Diesel (litres) value.`);
      }
      const vehicleNumber = getVehicleNumber(line) || defaultVehicleNumber;
      records.push({
        date,
        litres,
        ...(vehicleNumber ? { vehicleNumber } : {}),
      });
    });

    if (!records.length) throw new Error('No dated diesel records were found in the PDF.');
    return records;
  }

  if (format === 'csv') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = await workbook.csv.read(Readable.from([buffer]), {
      dateFormats: [],
      parserOptions: { delimiter: ',', ignoreEmpty: true, trim: true },
    });
    const result = parseWorksheetRecords(worksheet, true, targetVehicleNumber);
    if (!result.foundHeaders) {
      throw new Error('The CSV must contain columns named "Date" and "Diesel (litres)".');
    }
    if (!result.records.length) throw new Error('No dated diesel records were found in the CSV.');
    return result.records;
  }

  if (!['xls', 'xlsx'].includes(format)) {
    throw new Error('Only PDF, CSV, and Excel (.xls/.xlsx) files can be processed.');
  }
  const workbook = await loadSpreadsheetWorkbook(buffer, format);
  const records = [];
  let hasExpectedHeaders = false;

  workbook.worksheets.forEach((worksheet) => {
    const result = parseWorksheetRecords(worksheet, false, targetVehicleNumber);
    hasExpectedHeaders ||= result.foundHeaders;
    records.push(...result.records);
  });

  if (!hasExpectedHeaders) {
    throw new Error('The workbook must contain columns named "Date" and "Diesel (litres)".');
  }
  if (!records.length) throw new Error('No dated diesel records were found in the workbook.');
  return records;
}

module.exports = {
  parseDate,
  normalizeVehicleNumber,
  getVehicleNumber,
  parseDieselRecords,
};
