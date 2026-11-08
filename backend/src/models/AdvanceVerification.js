const mongoose = require('mongoose');

const advanceRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0 },
    vehicleNumber: { type: String, trim: true, uppercase: true, default: null },
  },
  { _id: false }
);

const advanceVerificationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    originalName: { type: String, required: true, maxlength: 255 },
    contentType: {
      type: String,
      enum: [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ],
      required: true,
    },
    fileData: { type: Buffer, required: true, select: false },
    advanceRecords: { type: [advanceRecordSchema], default: [] },
    fileHash: { type: String, default: null, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

advanceVerificationSchema.index({ vehicle: 1, month: 1, createdAt: -1 });

module.exports = mongoose.model('AdvanceVerification', advanceVerificationSchema);
