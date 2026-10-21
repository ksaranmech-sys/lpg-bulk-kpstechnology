const mongoose = require('mongoose');

// A one-off vehicle running cost (tax, permit, insurance, service, ...) logged by the customer admin.
const vehicleExpenseSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
    // Free text so admins can pick a preset (Quarter Tax, Insurance, ...) or type their own.
    category: { type: String, required: true, trim: true, maxlength: 100 },
    tyreMaker: { type: String, trim: true, maxlength: 100 },
    tyreModel: { type: String, trim: true, maxlength: 100 },
    tyrePosition: { type: String, trim: true, maxlength: 50 },
    tyreNumber: { type: String, trim: true, maxlength: 50 },
    tyreNumber2: { type: String, trim: true, maxlength: 50 },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 500 },
    // Optional receipt / bill photo (URL from the upload middleware - local disk or Cloudinary).
    photo: { url: { type: String } },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

vehicleExpenseSchema.index({ customer: 1, date: -1 });
vehicleExpenseSchema.index({ vehicle: 1, date: -1 });

module.exports = mongoose.model('VehicleExpense', vehicleExpenseSchema);
