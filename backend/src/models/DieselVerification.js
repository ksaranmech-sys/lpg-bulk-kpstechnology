const mongoose = require('mongoose');

const dieselRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    litres: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const dieselVerificationSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    originalName: { type: String, required: true, maxlength: 255 },
    contentType: {
      type: String,
      enum: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv',
      ],
      required: true,
    },
    fileData: { type: Buffer, required: true, select: false },
    dieselRecords: { type: [dieselRecordSchema], default: [] },
    recordsParserVersion: { type: Number, default: 0 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

dieselVerificationSchema.index({ vehicle: 1, month: 1, createdAt: -1 });

module.exports = mongoose.model('DieselVerification', dieselVerificationSchema);
