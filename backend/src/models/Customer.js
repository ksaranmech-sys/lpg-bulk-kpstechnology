const mongoose = require('mongoose');

/**
 * Customer = the "subgroup". Every vehicle, user, and trip belongs to exactly
 * one Customer. This is the tenant boundary in an otherwise single database
 * (multi-tenant via customerId, not separate DBs) — simplest to scale and to
 * later expose identically to the mobile app.
 */
const customerSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ email: 1 });

module.exports = mongoose.model('Customer', customerSchema);
