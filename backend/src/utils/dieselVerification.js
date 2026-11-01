const ExcelJS = require('exceljs');
const { PDFParse } = require('pdf-parse');
const { Readable } = require('stream');

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
  const localDate = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i);
  if (localDate) {
    const [, dayText, monthText, yearText] = localDate;
    return buildUtcDate(Number(yearText), Number(monthText) - 1, Number(dayText));
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

function findHeader(worksheet, allowCsvHeaders = false) {
  const maxRow = Math.min(worksheet.rowCount, 20);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    let dateColumn = 0;
    let litresColumn = 0;
    row.eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const header = normalizeHeader(getCellValue(cell));
      if (
        ['date', 'settlementdate', 'settlementdatetime'].includes(header)
        || (allowCsvHeaders && ['transactiondate', 'transactiondatetime', 'transactiontimestamp', 'txndate', 'postingdate', 'dateandtime'].includes(header))
      ) dateColumn = columnNumber;
      if (
        ['diesellitres', 'diesellitre', 'quantity', 'qty', 'volume', 'dieselquantity', 'dieselqty'].includes(header)
        || (allowCsvHeaders && (
          ['litres', 'litre', 'liters', 'liter', 'quantitylitres', 'quantityliters'].includes(header)
          || (header.includes('diesel') && /(litre|liter|ltr|qty|quantity|volume)/.test(header))
        ))
      ) litresColumn = columnNumber;
    });
    if (dateColumn && litresColumn) return { rowNumber, dateColumn, litresColumn };
  }
  return null;
}

function parseWorksheetRecords(worksheet, allowCsvHeaders = false) {
  const records = [];
  const header = findHeader(worksheet, allowCsvHeaders);
  if (!header) return { foundHeaders: false, records };

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const dateValue = getCellValue(row.getCell(header.dateColumn));
    const litresValue = getCellValue(row.getCell(header.litresColumn));
    if ((dateValue == null || dateValue === '') && (litresValue == null || litresValue === '')) continue;

    const date = parseDate(dateValue);
    if (litresValue == null || String(litresValue).trim() === '') {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Diesel (litres) value.`);
    }
    const litresText = typeof litresValue === 'string' ? litresValue.replace(/,/g, '').trim() : litresValue;
    const litres = Number(litresText);
    if (!date) throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a valid Date.`);
    if (!Number.isFinite(litres) || litres < 0) {
      throw new Error(`Row ${rowNumber} in "${worksheet.name}" needs a non-negative Diesel (litres) value.`);
    }
    records.push({ date, litres });
  }
  return { foundHeaders: true, records };
}

async function parseDieselRecords(buffer, format = 'xlsx') {
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
    const records = [];

    lines.forEach((line, index) => {
      const dateMatch = datePattern.exec(line);
      datePattern.lastIndex = 0;
      if (!dateMatch) return;

      const date = parseDate(dateMatch[0]);
      const values = [...line.slice(dateMatch.index + dateMatch[0].length).matchAll(numberPattern)];
      const litresText = values.at(-1)?.[0];
      if (!date) throw new Error(`PDF row ${index + 1} needs a valid Date.`);
      if (litresText == null) return;

      const litres = Number(litresText.replace(/,/g, ''));
      if (!Number.isFinite(litres) || litres < 0) {
        throw new Error(`PDF row ${index + 1} needs a non-negative Diesel (litres) value.`);
      }
      records.push({ date, litres });
    });

    if (!records.length) throw new Error('No dated diesel records were found in the PDF.');
    return records;
  }

  const workbook = new ExcelJS.Workbook();
  if (format === 'csv') {
    const worksheet = await workbook.csv.read(Readable.from([buffer]), {
      parserOptions: { delimiter: ',', ignoreEmpty: true, trim: true },
    });
    const result = parseWorksheetRecords(worksheet, true);
    if (!result.foundHeaders) {
      throw new Error('The CSV must contain columns named "Date" and "Diesel (litres)".');
    }
    if (!result.records.length) throw new Error('No dated diesel records were found in the CSV.');
    return result.records;
  }

  if (format !== 'xlsx') throw new Error('Only PDF, CSV, and Excel (.xlsx) files can be processed.');
  await workbook.xlsx.load(buffer);
  const records = [];
  let hasExpectedHeaders = false;

  workbook.worksheets.forEach((worksheet) => {
    const result = parseWorksheetRecords(worksheet);
    hasExpectedHeaders ||= result.foundHeaders;
    records.push(...result.records);
  });

  if (!hasExpectedHeaders) {
    throw new Error('The workbook must contain columns named "Date" and "Diesel (litres)".');
  }
  if (!records.length) throw new Error('No dated diesel records were found in the workbook.');
  return records;
}

module.exports = { parseDieselRecords };
