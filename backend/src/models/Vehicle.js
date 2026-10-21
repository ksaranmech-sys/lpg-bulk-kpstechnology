const mongoose = require('mongoose');
const { VEHICLE_CORPORATIONS } = require('../config/constants');

const reminderDocumentSchema = new mongoose.Schema(
  {
    expiryDate: { type: Date, default: null },
    lastReminderSentAt: { type: Date, default: null },
  },
  { _id: false }
);

const tyrePositionSchema = new mongoose.Schema(
  {
    position: { type: Number, required: true, min: 1, max: 7 },
    tyreNumber: { type: String, trim: true, maxlength: 50, default: '' },
    tyreNumber2: { type: String, trim: true, maxlength: 50, default: '' },
    installedOdometerKm: { type: Number, min: 0, default: null },
    expectedMileageKm: { type: Number, min: 0, default: null },
    // Legacy data stored the tyre installation reading as odometerKm.
    odometerKm: { type: Number, min: 0, default: null },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    // Contracting corporation; null for vehicles added before the field existed.
    corporation: { type: String, enum: [...VEHICLE_CORPORATIONS, null], default: null },
    isActive: { type: Boolean, default: true },
    // Running odometer cache, updated whenever a new diesel entry is recorded,
    // so the UI can show "last known KM" without recomputing from trip history.
    lastKnownOdometer: { type: Number, default: null },
    tyres: {
      type: [tyrePositionSchema],
      default: () => Array.from({ length: 7 }, (_, index) => ({ position: index + 1 })),
    },
    documentReminders: {
      qTax: { type: reminderDocumentSchema, default: () => ({}) },
      fitness: { type: reminderDocumentSchema, default: () => ({}) },
      permitOneYear: { type: reminderDocumentSchema, default: () => ({}) },
      permitFiveYear: { type: reminderDocumentSchema, default: () => ({}) },
      purging: { type: reminderDocumentSchema, default: () => ({}) },
      explosive: { type: reminderDocumentSchema, default: () => ({}) },
      pli: { type: reminderDocumentSchema, default: () => ({}) },
      vehicleInsurance: { type: reminderDocumentSchema, default: () => ({}) },
      cllInsurance: { type: reminderDocumentSchema, default: () => ({}) },
      hydroCertificate: { type: reminderDocumentSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ customer: 1, vehicleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
