// @ts-nocheck
import mongoose from "mongoose";

const DriverSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    name: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    licenseNumber: { type: String, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

DriverSchema.index({ customerId: 1, name: 1 });

export default mongoose.models.Driver || mongoose.model("Driver", DriverSchema);