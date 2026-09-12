const mongoose = require('mongoose');

const reminderDocumentSchema = new mongoose.Schema(
  {
    expiryDate: { type: Date, default: null },
    lastReminderSentAt: { type: Date, default: null },
  },
  { _id: false }
);

const vehicleSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    isActive: { type: Boolean, default: true },
    // Running odometer cache, updated whenever a new diesel entry is recorded,
    // so the UI can show "last known KM" without recomputing from trip history.
    lastKnownOdometer: { type: Number, default: null },
    documentReminders: {
      qTax: { type: reminderDocumentSchema, default: () => ({}) },
      fitness: { type: reminderDocumentSchema, default: () => ({}) },
      permitOneYear: { type: reminderDocumentSchema, default: () => ({}) },
      permitFiveYear: { type: reminderDocumentSchema, default: () => ({}) },
      purging: { type: reminderDocumentSchema, default: () => ({}) },
      explosive: { type: reminderDocumentSchema, default: () => ({}) },
      pli: { type: reminderDocumentSchema, default: () => ({}) },
      vehicleInsurance: { type: reminderDocumentSchema, default: () => ({}) },
      hydroCertificate: { type: reminderDocumentSchema, default: () => ({}) },
    },
  },
  { timestamps: true }
);

vehicleSchema.index({ customer: 1, vehicleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
