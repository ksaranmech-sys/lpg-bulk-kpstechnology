const mongoose = require('mongoose');
const { TRIP_STATUS } = require('../config/constants');

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true }, // returned by /api/v1/uploads (local disk or S3)
    gps: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false }
);

const advanceSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
  },
  { _id: false }
);

// One diesel fill event. `odometerKm` is optional per fill (spec: "KM optional"),
// but the FIRST fill of a trip and the fill that closes it must have odometerKm
// for the mileage math to work — this is enforced in tripCalculations.js, not
// at the schema level, so partial entries can still be saved from the field.
const dieselEntrySchema = new mongoose.Schema(
  {
    volumeLitres: { type: Number, required: true, min: 0 },
    ratePerLitre: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // volumeLitres * ratePerLitre, computed
    paymentMethod: { type: String, enum: ['diesel_card', 'cash'], default: 'diesel_card' },
    odometerKm: { type: Number, default: null },
    filledAt: { type: Date, required: true, default: Date.now },
    photo: photoSchema,
  },
  { timestamps: true }
);

const rtoEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    photo: photoSchema,
  },
  { timestamps: true }
);

const otherExpenseSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    photo: photoSchema,
  },
  { timestamps: true }
);

const tripSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true, index: true },

    driverAdvances: { type: [advanceSchema], default: [] },

    loadingLocation: { type: String, trim: true },
    loadingDate: { type: Date },
    loadingExpense: { type: Number, default: 0, min: 0 },

    dieselEntries: { type: [dieselEntrySchema], default: [] },

    rtoEntries: { type: [rtoEntrySchema], default: [] },

    unloadingLocation: { type: String, trim: true },
    unloadingDate: { type: Date },
    unloadingExpense: { type: Number, default: 0, min: 0 },
    manualKm: { type: Number, default: null, min: 0 },

    turnNumber: { type: Number, min: 0 },
    turnDate: { type: Date },
    fillingOrderLocation: { type: String, trim: true },
    unTurnNumber: { type: Number, min: 0 },
    unTurnDate: { type: Date },

    otherExpenses: { type: [otherExpenseSchema], default: [] },

    status: { type: String, enum: Object.values(TRIP_STATUS), default: TRIP_STATUS.OPEN },

    // Filled in by closeTrip() in tripCalculations.js once the NEXT trip's
    // first diesel entry exists (that's what actually closes this trip -
    // see spec: "Trip closes once again diesel filled at loading location").
    closedAt: { type: Date, default: null },
    nextTrip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },

    settlement: {
      totalDieselLitres: { type: Number, default: null },
      totalDieselCost: { type: Number, default: null },
      totalKm: { type: Number, default: null },
      mileageKmPerLitre: { type: Number, default: null },
      totalExpense: { type: Number, default: null }, // everything except diesel
      totalAdvance: { type: Number, default: null },
      balance: { type: Number, default: null }, // advance - totalExpense (+ve = driver owes back, -ve = company owes driver)
      calculatedAt: { type: Date, default: null },
    },

    reportSentAt: { type: Date, default: null },
    reportSentTo: { type: String, default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

tripSchema.index({ vehicle: 1, createdAt: 1 });

module.exports = mongoose.model('Trip', tripSchema);
