// @ts-nocheck
import mongoose from "mongoose";

// One sub-document per expiring document type. `reminderRule` drives the cron logic.
const DocEntrySchema = new mongoose.Schema(
  {
    expiryDate: { type: Date },
    reminderRule: {
      type: String,
      enum: ["QUARTER_END", "DAYS_BEFORE_15"],
      required: true,
    },
    lastReminderSentFor: { type: String }, // dedupe key so we don't email twice for the same period
  },
  { _id: false }
);

const VehicleSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    vehicleNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },

    documents: {
      qTax: { type: DocEntrySchema, default: () => ({ reminderRule: "QUARTER_END" }) },
      fitness: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      permit1Year: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      permit5Year: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      purging: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      explosive: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      pli: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      insurance: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
      hydroCertificate: { type: DocEntrySchema, default: () => ({ reminderRule: "DAYS_BEFORE_15" }) },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Vehicle || mongoose.model("Vehicle", VehicleSchema);
