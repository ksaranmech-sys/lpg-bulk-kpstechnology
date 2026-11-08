const crypto = require('crypto');
const mongoose = require('mongoose');
const DieselVerification = require('../models/DieselVerification');
const Vehicle = require('../models/Vehicle');
const { ROLES } = require('../config/constants');
const { parseDieselRecords } = require('../utils/dieselVerification');
const {
  XLSX_CONTENT_TYPE,
  XLS_CONTENT_TYPE,
  getSpreadsheetFormat,
} = require('../utils/spreadsheet');

const CSV_CONTENT_TYPE = 'text/csv';
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECORDS_PARSER_VERSION = 3;

function safeFileName(value) {
  return String(value || 'diesel-report')
    .replace(/[\\/"]/g, '_')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '_' : character;
    })
    .join('')
    .slice(0, 180) || 'diesel-report';
}

function contentDispositionFileName(value) {
  const fileName = safeFileName(value);
  const fallback = Array.from(fileName)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code > 126 || character === '"' || character === '\\' ? '_' : character;
    })
    .join('');
  const encoded = encodeURIComponent(fileName).replace(/[!'()*]/g, (character) => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function publicUpload(upload) {
  const result = upload.toObject();
  delete result.fileData;
  delete result.recordsParserVersion;
  delete result.fileHash;
  if (result.vehicle && typeof result.vehicle === 'object') {
    result.defaultVehicleNumber = result.vehicle.vehicleNumber || '';
  }
  return result;
}

async function getAuthorizedVehicle(user, vehicleId) {
  if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
    return { error: { status: 400, message: 'A valid vehicleId is required' } };
  }
  const vehicle = await Vehicle.findById(vehicleId).select('_id customer vehicleNumber');
  if (!vehicle) return { error: { status: 404, message: 'Vehicle not found' } };
  if (user.role === ROLES.CUSTOMER_ADMIN && String(vehicle.customer) !== String(user.customer)) {
    return { error: { status: 403, message: 'Vehicle does not belong to your account' } };
  }
  return { vehicle };
}

async function reprocessLegacyUploads(customerId, month) {
  const filter = {
    customer: customerId,
    $or: [
      { recordsParserVersion: { $lt: RECORDS_PARSER_VERSION } },
      { recordsParserVersion: { $exists: false } },
      { fileHash: null },
    ],
  };
  if (month) filter.month = month;

  const uploads = await DieselVerification.find(filter)
    .select('+fileData')
    .populate('vehicle', 'vehicleNumber')
    .sort({ createdAt: 1, _id: 1 });
  for (const upload of uploads) {
    const format = upload.contentType === 'application/pdf'
      ? 'pdf'
      : upload.contentType === CSV_CONTENT_TYPE
        ? 'csv'
        : upload.contentType === XLS_CONTENT_TYPE ? 'xls' : 'xlsx';
    upload.dieselRecords = await parseDieselRecords(
      upload.fileData,
      format,
      upload.vehicle?.vehicleNumber || ''
    );
    upload.recordsParserVersion = RECORDS_PARSER_VERSION;
    upload.fileHash ||= crypto.createHash('sha256').update(upload.fileData).digest('hex');
    await upload.save();
  }
}

async function listDieselVerifications(req, res) {
  const { vehicleId, month, fromDate, toDate } = req.query;
  const hasDateRange = fromDate != null || toDate != null;
  if (!vehicleId || (hasDateRange
    ? !DATE_PATTERN.test(String(fromDate || '')) || !DATE_PATTERN.test(String(toDate || ''))
    : !MONTH_PATTERN.test(String(month || '')))) {
    return res.status(400).json({ error: 'vehicleId and either a valid month (YYYY-MM) or date range (fromDate and toDate) are required' });
  }
  const filter = { customer: null };
  if (hasDateRange) {
    const start = new Date(`${fromDate}T00:00:00.000Z`);
    const end = new Date(`${toDate}T00:00:00.000Z`);
    if (
      Number.isNaN(start.getTime())
      || Number.isNaN(end.getTime())
      || start.toISOString().slice(0, 10) !== fromDate
      || end.toISOString().slice(0, 10) !== toDate
      || start > end
    ) {
      return res.status(400).json({ error: 'fromDate and toDate must be valid dates with fromDate on or before toDate' });
    }
    filter.dieselRecords = { $elemMatch: { date: { $gte: start, $lte: end } } };
  } else {
    filter.month = month;
  }
  const { vehicle, error } = await getAuthorizedVehicle(req.user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  filter.customer = vehicle.customer;
  await reprocessLegacyUploads(vehicle.customer, hasDateRange ? undefined : month);
  const uploads = await DieselVerification.find(filter)
    .populate('vehicle', 'vehicleNumber')
    .sort({ createdAt: 1, _id: 1 });
  const seenFileHashes = new Set();
  const uniqueUploads = uploads.filter((upload) => {
    if (!upload.fileHash) return true;
    if (seenFileHashes.has(upload.fileHash)) return false;
    seenFileHashes.add(upload.fileHash);
    return true;
  });
  res.json({ uploads: uniqueUploads.map(publicUpload) });
}

async function createDieselVerification(req, res) {
  const { vehicleId, month } = req.body;
  if (!req.file) return res.status(400).json({ error: 'A PDF, .xls/.xlsx, or .csv file is required' });
  if (!MONTH_PATTERN.test(String(month || ''))) {
    return res.status(400).json({ error: 'A valid month (YYYY-MM) is required' });
  }

  const { vehicle, error } = await getAuthorizedVehicle(req.user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  const fileHash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const existingUpload = await DieselVerification.findOne({
    customer: vehicle.customer,
    fileHash,
  });
  if (existingUpload) {
    return res.status(409).json({ error: 'This exact statement file has already been uploaded for this customer.' });
  }

  const extension = req.file.originalname.toLowerCase().split('.').pop();
  let contentType;
  let dieselRecords = [];
  if (extension === 'pdf' && req.file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    contentType = 'application/pdf';
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer, 'pdf', vehicle.vehicleNumber);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The PDF could not be read' });
    }
  } else if (['xls', 'xlsx'].includes(extension) && getSpreadsheetFormat(req.file.buffer) === extension) {
    contentType = extension === 'xls' ? XLS_CONTENT_TYPE : XLSX_CONTENT_TYPE;
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer, extension, vehicle.vehicleNumber);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The Excel workbook could not be read' });
    }
  } else if (extension === 'csv') {
    contentType = CSV_CONTENT_TYPE;
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer, 'csv', vehicle.vehicleNumber);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The CSV file could not be read' });
    }
  } else {
    return res.status(400).json({ error: 'Upload a valid PDF, Excel .xls/.xlsx, or CSV file' });
  }

  const upload = await DieselVerification.create({
    customer: vehicle.customer,
    vehicle: vehicle._id,
    month,
    originalName: safeFileName(req.file.originalname),
    contentType,
    fileData: req.file.buffer,
    dieselRecords,
    recordsParserVersion: RECORDS_PARSER_VERSION,
    fileHash,
    uploadedBy: req.user.id,
  });
  res.status(201).json({ upload: publicUpload(upload) });
}

async function downloadDieselVerification(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.verificationId)) {
    return res.status(400).json({ error: 'Invalid diesel verification ID' });
  }
  const upload = await DieselVerification.findById(req.params.verificationId).select('+fileData');
  if (!upload) return res.status(404).json({ error: 'Diesel verification file not found' });
  if (
    req.user.role === ROLES.CUSTOMER_ADMIN
    && String(upload.customer) !== String(req.user.customer)
  ) {
    return res.status(403).json({ error: 'You do not have permission to access this file' });
  }

  res.setHeader('Content-Type', upload.contentType);
  res.setHeader('Content-Length', upload.fileData.length);
  res.setHeader('Content-Disposition', contentDispositionFileName(upload.originalName));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(upload.fileData);
}

async function deleteDieselVerification(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.verificationId)) {
    return res.status(400).json({ error: 'Invalid diesel verification ID' });
  }
  const upload = await DieselVerification.findById(req.params.verificationId);
  if (!upload) return res.status(404).json({ error: 'Diesel verification file not found' });
  if (
    req.user.role === ROLES.CUSTOMER_ADMIN
    && String(upload.customer) !== String(req.user.customer)
  ) {
    return res.status(403).json({ error: 'You do not have permission to delete this file' });
  }

  await upload.deleteOne();
  res.json({ message: 'Diesel verification file deleted' });
}

module.exports = {
  listDieselVerifications,
  createDieselVerification,
  downloadDieselVerification,
  deleteDieselVerification,
};
