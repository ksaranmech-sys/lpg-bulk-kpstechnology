const mongoose = require('mongoose');

// A leave entry submitted by a driver (or logged by the admin) for a date range.
const leaveSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// listLeaves filters by customer or driver and sorts by startDate desc.
leaveSchema.index({ customer: 1, startDate: -1 });
leaveSchema.index({ driver: 1, startDate: -1 });

module.exports = mongoose.model('Leave', leaveSchema);
