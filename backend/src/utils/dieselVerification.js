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
  const text = String(value || '').trim().replace(/^'+|'+$/g, '');
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

async function parseDieselRecords(buffer, format = 'xlsx', targetVehicleNumber = '') {
  let dieselRecords;
  try {
    ({ dieselRecords } = await parseFuelRecords(buffer, format, targetVehicleNumber));
  } catch (error) {
    if (/^No dated Diesel or DEF records were found/.test(error.message)) {
      throw new Error(`No dated diesel records were found in the ${format === 'pdf' ? 'PDF' : 'file'}.`);
    }
    throw error;
  }
  if (!dieselRecords.length) throw new Error(`No dated diesel records were found in the ${format === 'pdf' ? 'PDF' : 'file'}.`);
  return dieselRecords;
}

function findFuelHeader(worksheet) {
  const dateHeaders = new Set([
    'date', 'settlementdate', 'settlementdatetime', 'transactiondate', 'transactiondatetime',
    'transactiontimestamp', 'txndate', 'txndatetime', 'txntimestamp', 'postingdate', 'dateandtime',
  ]);
  const vehicleHeaders = new Set([
    'vehicle', 'vehicleno', 'vehiclenumber', 'vehicleregistration', 'registrationno',
    'registrationnumber', 'regno', 'truckno', 'trucknumber', 'vehiclenocard', 'vehiclenouserentry',
  ]);
  const quantityHeaders = new Set(['quantity', 'qty', 'volume', 'litres', 'litre', 'liters', 'liter']);
  const amountHeaders = new Set(['amount', 'transactionamount', 'saleamount', 'value']);
  const productHeaders = new Set(['product', 'productname', 'fuel', 'fueltype', 'type', 'item', 'description']);
  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    const header = {
      rowNumber,
      dieselColumn: 0,
      defColumn: 0,
      quantityColumn: 0,
      productColumn: 0,
      dateColumn: 0,
      amountColumn: 0,
      vehicleColumns: [],
    };
    worksheet.getRow(rowNumber).eachCell({ includeEmpty: false }, (cell, columnNumber) => {
      const value = normalizeHeader(getCellValue(cell));
      if (dateHeaders.has(value) && !header.dateColumn) header.dateColumn = columnNumber;
      if (vehicleHeaders.has(value)) header.vehicleColumns.push(columnNumber);
      if (productHeaders.has(value) && (value !== 'description' || !header.productColumn)) {
        header.productColumn = columnNumber;
      }
      if ((amountHeaders.has(value) || value.startsWith('amount')) && !header.amountColumn) {
        header.amountColumn = columnNumber;
      }
      if (quantityHeaders.has(value) || /(quantity|qty|volume|litres?|liters?)$/.test(value)) {
        header.quantityColumn = columnNumber;
      }
      if (value.startsWith('diesel') && /(litres?|liters?|ltr|qty|quantity|volume|l)$/.test(value)) {
        header.dieselColumn = columnNumber;
      }
      if (/^(def|adblue|urea)$/.test(value)
        || (/^(def|adblue|urea)/.test(value) && /(litres?|liters?|ltr|qty|quantity|volume|l)$/.test(value))) {
        header.defColumn = columnNumber;
      }
    });
    if (header.dateColumn && (
      header.dieselColumn
      || header.defColumn
      || header.quantityColumn
      || (header.productColumn && header.amountColumn)
    )) return header;
  }
  return null;
}

function isDefProduct(value) {
  return /\b(?:def|ad[\s-]?blue|urea)\b/i.test(String(value || ''));
}

function isDieselProduct(value) {
  return /\bdiesel\b/i.test(String(value || ''));
}

function pdfDefAmountText(transactionText, dateMatch, hasDefAmountHeader) {
  const productMatch = /\b(?:DEF|AD[\s-]?BLUE|UREA)\b/i.exec(transactionText);
  if (!productMatch && !hasDefAmountHeader) return null;
  const remainingText = transactionText
    .slice(productMatch
      ? productMatch.index + productMatch[0].length
      : dateMatch.index + dateMatch[0].length)
    .replace(/\b[A-Z]{2}\s*\d{2}\s*[A-Z]{1,3}\s*\d{4}\b/gi, ' ');
  const values = [...remainingText.matchAll(/-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g)];
  return values.at(-1)?.[0] || null;
}

function fuelRecord(date, litresValue, vehicleNumber, label, rowNumber) {
  if (litresValue == null || String(litresValue).trim() === '') {
    throw new Error(`Row ${rowNumber} needs a non-negative ${label} (litres) value.`);
  }
  const litresText = typeof litresValue === 'string' ? litresValue.replace(/,/g, '').trim() : litresValue;
  const litres = Number(litresText);
  if (!Number.isFinite(litres) || litres < 0) {
    throw new Error(`Row ${rowNumber} needs a non-negative ${label} (litres) value.`);
  }
  return { date, litres, ...(vehicleNumber ? { vehicleNumber } : {}) };
}

function fuelAmountRecord(date, amountValue, vehicleNumber, rowNumber) {
  if (amountValue == null || ['-', ''].includes(String(amountValue).trim())) return null;
  const text = typeof amountValue === 'string'
    ? amountValue.replace(/,/g, '').replace(/₹|rs\.?/gi, '').replace(/^'+|'+$/g, '').trim()
    : amountValue;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Row ${rowNumber} needs a non-negative DEF Amount value.`);
  }
  return { date, amount, ...(vehicleNumber ? { vehicleNumber } : {}) };
}

function parseFuelWorksheet(worksheet, targetVehicleNumber) {
  const header = findFuelHeader(worksheet);
  if (!header) return { foundHeaders: false, dieselRecords: [], defRecords: [] };
  const normalizedTargetVehicle = normalizeVehicleNumber(targetVehicleNumber);
  const dieselRecords = [];
  const defRecords = [];
  const defAmountRecords = [];
  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const dateValue = getCellValue(row.getCell(header.dateColumn));
    const date = parseDate(dateValue);
    if (!date) continue;
    const vehicleNumber = header.vehicleColumns
      .map((columnNumber) => normalizeVehicleNumber(getCellValue(row.getCell(columnNumber))))
      .find(Boolean) || normalizedTargetVehicle;

    if (header.quantityColumn && header.productColumn && !header.dieselColumn && !header.defColumn) {
      const product = getCellValue(row.getCell(header.productColumn));
      const quantity = getCellValue(row.getCell(header.quantityColumn));
      if (isDefProduct(product)) {
        const amountRecord = header.amountColumn
          ? fuelAmountRecord(date, getCellValue(row.getCell(header.amountColumn)), vehicleNumber, rowNumber)
          : null;
        if (amountRecord) defAmountRecords.push(amountRecord);
        if (quantity != null && !['-', ''].includes(String(quantity).trim())) {
          const record = fuelRecord(date, quantity, vehicleNumber, 'DEF', rowNumber);
          if (record) defRecords.push(record);
        }
      } else if (isDieselProduct(product)) {
        if (quantity == null || ['-', ''].includes(String(quantity).trim())) continue;
        const record = fuelRecord(date, quantity, vehicleNumber, 'Diesel', rowNumber);
        if (record) dieselRecords.push(record);
      }
      continue;
    }

    let hasDefAmount = false;
    if (header.productColumn && isDefProduct(getCellValue(row.getCell(header.productColumn)))) {
      const amountRecord = header.amountColumn
        ? fuelAmountRecord(date, getCellValue(row.getCell(header.amountColumn)), vehicleNumber, rowNumber)
        : null;
      if (amountRecord) {
        defAmountRecords.push(amountRecord);
        hasDefAmount = true;
      }
    }

    if (header.dieselColumn) {
      const value = getCellValue(row.getCell(header.dieselColumn));
      if (!(hasDefAmount && (value == null || ['-', ''].includes(String(value).trim())))) {
        const record = fuelRecord(date, value, vehicleNumber, 'Diesel', rowNumber);
        if (record) dieselRecords.push(record);
      }
    } else if (header.quantityColumn && !header.defColumn) {
      const record = fuelRecord(date, getCellValue(row.getCell(header.quantityColumn)), vehicleNumber, 'Diesel', rowNumber);
      if (record) dieselRecords.push(record);
    }
    if (header.defColumn) {
      const value = getCellValue(row.getCell(header.defColumn));
      if (!(hasDefAmount && (value == null || ['-', ''].includes(String(value).trim())))) {
        const record = fuelRecord(date, value, vehicleNumber, 'DEF', rowNumber);
        if (record) defRecords.push(record);
      }
    }
  }
  return {
    foundHeaders: true,
    dieselRecords,
    defRecords,
    ...(defAmountRecords.length ? { defAmountRecords } : {}),
  };
}

async function loadFuelWorksheet(buffer, format) {
  if (format === 'csv') {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.csv.read(Readable.from([buffer]), {
      dateFormats: [],
      parserOptions: { delimiter: ',', ignoreEmpty: true, trim: true },
    });
    return workbook;
  }
  if (!['xls', 'xlsx'].includes(format)) {
    throw new Error('Only PDF, CSV, and Excel (.xls/.xlsx) files can be processed.');
  }
  return loadSpreadsheetWorkbook(buffer, format);
}

async function parsePdfFuelRecords(buffer, targetVehicleNumber) {
  const parser = new PDFParse({ data: buffer });
  let text;
  try {
    ({ text } = await parser.getText());
  } catch (error) {
    throw new Error('The PDF could not be read. Upload a valid PDF with selectable text.');
  } finally {
    await parser.destroy();
  }

  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:page\s*)?[-–—]*\s*\d+\s+of\s+\d+\s*[-–—]*\s*$/i.test(line));
  const normalizedHeaders = normalizeHeader(lines.slice(0, 40).join(' '));
  const hasDateHeader = normalizedHeaders.includes('date');
  const hasDieselHeader = /diesel(litres?|liters?|quantity|qty|volume)/.test(normalizedHeaders);
  const hasDefHeader = /(def|adblue|urea)(litres?|liters?|quantity|qty|volume)/.test(normalizedHeaders);
  const hasDefAmountHeader = /(def|adblue|urea)amount/.test(normalizedHeaders);
  const hasAmountHeader = normalizedHeaders.includes('amount');
  const hasProductHeader = /(product|productname|fuel|fueltype|description)/.test(normalizedHeaders);
  const hasQuantityHeader = /(quantity|qty|volume|litres?|liters?)/.test(normalizedHeaders);
  if (!text || !hasDateHeader || (
    !hasDieselHeader
    && !hasDefHeader
    && !hasDefAmountHeader
    && !(hasProductHeader && (hasQuantityHeader || hasAmountHeader))
  )) {
    throw new Error('The PDF must contain a date and Diesel or DEF quantity or amount.');
  }

  const datePattern = /\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|\d{1,2}[- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[- ]\d{2,4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)?/i;
  const numberPattern = /-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g;
  const dieselPattern = /DIESEL\s*,?\s*CCMS\s+[\d,]+(?:\.\d+)?\s+([\d,]+(?:\.\d+)?)/i;
  const defPattern = /\b(?:DEF|AD[\s-]?BLUE|UREA)\b[^\d]{0,20}([\d,]+(?:\.\d+)?)/i;
  const defaultVehicleNumber = normalizeVehicleNumber(targetVehicleNumber);
  const dieselRecords = [];
  const defRecords = [];
  const defAmountRecords = [];

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
    const isDef = isDefProduct(transactionText);
    const isDiesel = isDieselProduct(transactionText);
    const vehicleNumber = getVehicleNumber(line) || defaultVehicleNumber;
    let litresText;
    let targetRecords;
    let label;
    if ((isDef || (hasDefAmountHeader && !hasProductHeader)) && (hasAmountHeader || hasDefAmountHeader)) {
      const amountText = pdfDefAmountText(transactionText, dateMatch, hasDefAmountHeader);
      if (amountText != null) {
        const amountRecord = fuelAmountRecord(date, amountText, vehicleNumber, index + 1);
        if (amountRecord) defAmountRecords.push(amountRecord);
      }
    }
    if (isDef) {
      if (hasDefHeader || (hasProductHeader && hasQuantityHeader)) {
        litresText = transactionText.match(defPattern)?.[1];
        targetRecords = defRecords;
        label = 'DEF';
      }
    } else if (isDiesel || (hasDieselHeader && !hasDefHeader)) {
      litresText = transactionText.match(dieselPattern)?.[1];
      if (litresText == null) {
        const values = [...line.slice(dateMatch.index + dateMatch[0].length).matchAll(numberPattern)];
        litresText = values.at(-1)?.[0];
      }
      targetRecords = dieselRecords;
      label = 'Diesel';
    } else if (hasDefHeader && !hasDieselHeader) {
      const values = [...line.slice(dateMatch.index + dateMatch[0].length).matchAll(numberPattern)];
      litresText = values.at(-1)?.[0];
      targetRecords = defRecords;
      label = 'DEF';
    }
    if (litresText == null || !targetRecords) return;
    const record = fuelRecord(date, litresText, vehicleNumber, label, index + 1);
    if (record) targetRecords.push(record);
  });
  return {
    dieselRecords,
    defRecords,
    ...(defAmountRecords.length ? { defAmountRecords } : {}),
  };
}

async function parseFuelRecords(buffer, format = 'xlsx', targetVehicleNumber = '') {
  if (format === 'pdf') {
    const records = await parsePdfFuelRecords(buffer, targetVehicleNumber);
    if (!records.dieselRecords.length && !records.defRecords.length && !records.defAmountRecords?.length) {
      throw new Error('No dated Diesel or DEF records were found in the PDF.');
    }
    return records;
  }

  const workbook = await loadFuelWorksheet(buffer, format);
  const records = { dieselRecords: [], defRecords: [], defAmountRecords: [] };
  let foundHeaders = false;
  workbook.worksheets.forEach((worksheet) => {
    const parsed = parseFuelWorksheet(worksheet, targetVehicleNumber);
    foundHeaders ||= parsed.foundHeaders;
    records.dieselRecords.push(...parsed.dieselRecords);
    records.defRecords.push(...parsed.defRecords);
    records.defAmountRecords.push(...(parsed.defAmountRecords || []));
  });
  if (!foundHeaders) {
    const formatName = format === 'csv' ? 'CSV' : 'workbook';
    throw new Error(`The ${formatName} must contain columns named "Date" and "Diesel (litres)" or "DEF (litres)".`);
  }
  if (!records.dieselRecords.length && !records.defRecords.length && !records.defAmountRecords.length) {
    throw new Error('No dated Diesel or DEF records were found in the file.');
  }
  if (!records.defAmountRecords.length) delete records.defAmountRecords;
  return records;
}

module.exports = {
  parseDate,
  normalizeVehicleNumber,
  getVehicleNumber,
  parseDieselRecords,
  parseFuelRecords,
};
