const mongoose = require('mongoose');
const DieselVerification = require('../models/DieselVerification');
const Vehicle = require('../models/Vehicle');
const { ROLES } = require('../config/constants');
const { parseDieselRecords } = require('../utils/dieselVerification');

const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_CONTENT_TYPE = 'text/csv';
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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
  return result;
}

async function getAuthorizedVehicle(user, vehicleId) {
  if (!mongoose.Types.ObjectId.isValid(vehicleId)) {
    return { error: { status: 400, message: 'A valid vehicleId is required' } };
  }
  const vehicle = await Vehicle.findById(vehicleId).select('_id customer');
  if (!vehicle) return { error: { status: 404, message: 'Vehicle not found' } };
  if (user.role === ROLES.CUSTOMER_ADMIN && String(vehicle.customer) !== String(user.customer)) {
    return { error: { status: 403, message: 'Vehicle does not belong to your account' } };
  }
  return { vehicle };
}

async function listDieselVerifications(req, res) {
  const { vehicleId, month } = req.query;
  if (!vehicleId || !MONTH_PATTERN.test(String(month || ''))) {
    return res.status(400).json({ error: 'vehicleId and a valid month (YYYY-MM) are required' });
  }
  const { vehicle, error } = await getAuthorizedVehicle(req.user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  const uploads = await DieselVerification.find({ vehicle: vehicle._id, month })
    .sort({ createdAt: 1, _id: 1 });
  res.json({ uploads: uploads.map(publicUpload) });
}

async function createDieselVerification(req, res) {
  const { vehicleId, month } = req.body;
  if (!req.file) return res.status(400).json({ error: 'A PDF, .xlsx, or .csv file is required' });
  if (!MONTH_PATTERN.test(String(month || ''))) {
    return res.status(400).json({ error: 'A valid month (YYYY-MM) is required' });
  }

  const { vehicle, error } = await getAuthorizedVehicle(req.user, vehicleId);
  if (error) return res.status(error.status).json({ error: error.message });

  const extension = req.file.originalname.toLowerCase().split('.').pop();
  let contentType;
  let dieselRecords = [];
  if (extension === 'pdf' && req.file.buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    contentType = 'application/pdf';
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer, 'pdf');
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The PDF could not be read' });
    }
  } else if (extension === 'xlsx' && req.file.buffer.subarray(0, 2).toString('ascii') === 'PK') {
    contentType = EXCEL_CONTENT_TYPE;
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer);
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The Excel workbook could not be read' });
    }
  } else if (extension === 'csv') {
    contentType = CSV_CONTENT_TYPE;
    try {
      dieselRecords = await parseDieselRecords(req.file.buffer, 'csv');
    } catch (parseError) {
      return res.status(400).json({ error: parseError.message || 'The CSV file could not be read' });
    }
  } else {
    return res.status(400).json({ error: 'Upload a valid PDF, Excel .xlsx, or CSV file' });
  }

  const upload = await DieselVerification.create({
    customer: vehicle.customer,
    vehicle: vehicle._id,
    month,
    originalName: safeFileName(req.file.originalname),
    contentType,
    fileData: req.file.buffer,
    dieselRecords,
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
