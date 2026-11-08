const ExcelJS = require('exceljs');
const XLSX = require('@e965/xlsx');

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XLS_CONTENT_TYPE = 'application/vnd.ms-excel';

function isXlsxBuffer(buffer) {
  return buffer?.length >= 4
    && buffer[0] === 0x50
    && buffer[1] === 0x4b
    && buffer[2] === 0x03
    && buffer[3] === 0x04;
}

function isXlsBuffer(buffer) {
  return buffer?.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
}

function getSpreadsheetFormat(buffer) {
  if (isXlsxBuffer(buffer)) return 'xlsx';
  if (isXlsBuffer(buffer)) return 'xls';
  return null;
}

async function loadSpreadsheetWorkbook(buffer, format) {
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
  }
  if (format !== 'xls') throw new Error('Only legacy Excel (.xls) and Excel (.xlsx) workbooks are supported.');

  const parsedWorkbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const workbook = new ExcelJS.Workbook();
  parsedWorkbook.SheetNames.forEach((sheetName, index) => {
    const safeSheetName = sheetName.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || `Sheet ${index + 1}`;
    const worksheet = workbook.addWorksheet(safeSheetName);
    const rows = XLSX.utils.sheet_to_json(parsedWorkbook.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: null,
    });
    rows.forEach((row) => worksheet.addRow(row));
  });
  return workbook;
}

module.exports = {
  XLSX_CONTENT_TYPE,
  XLS_CONTENT_TYPE,
  getSpreadsheetFormat,
  loadSpreadsheetWorkbook,
};
