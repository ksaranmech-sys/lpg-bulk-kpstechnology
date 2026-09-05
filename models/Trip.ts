// @ts-nocheck
import mongoose from "mongoose";

const LOADING_LOCATIONS = ["MRPL", "Total-Mangalore", "AEGIS-Mangalore", "IPPL-Chennai", "CPCL", "Tuthugudi", "KRL"];
const UNLOADING_LOCATIONS = [
  "Trichy", "Chengalpattu", "Madurai", "Manargudi", "Mayladuthurai",
  "Coimbatore", "Belgaum", "Shimoga", "Devanagunthi",
];

const PhotoSchema = new mongoose.Schema(
  { url: String, gps: { lat: Number, lng: Number } },
  { _id: false }
);

// Every diesel fill: the FIRST one recorded on a trip is the carry-over fill from the
// previous trip's closing point and is excluded from THIS trip's diesel/mileage maths.
const DieselFillSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  volume: { type: Number, required: true }, // litres
  rate: { type: Number, required: true }, // Rs per litre
  value: { type: Number, required: true }, // volume * rate (validated, not trusted from client)
  odometerKm: { type: Number }, // optional
  photo: PhotoSchema,
});

const RtoEntrySchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  photo: PhotoSchema, // GPS-tagged
});

const OtherExpenseSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  photo: PhotoSchema,
  note: String,
});

const TripSchema = new mongoose.Schema(
  {
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },

    driverAdvance: {
      amount: { type: Number, required: true },
      date: { type: Date, required: true },
    },

    loadingLocation: { type: String, enum: LOADING_LOCATIONS, required: true },
    loadingExpense: { type: Number, default: 0 }, // cleaner expense at loading
    unloadingLocation: { type: String, enum: UNLOADING_LOCATIONS },
    unloadingExpense: { type: Number, default: 0 }, // cleaner expense at unloading

    dieselFills: [DieselFillSchema],
    rtoEntries: [RtoEntrySchema],
    otherExpenses: [OtherExpenseSchema],

    // "open" while on the road, "closed" once diesel is filled again at the NEXT loading point
    status: { type: String, enum: ["open", "closed"], default: "open" },
    closedAt: Date,

    // Snapshot of the calculation done at close time (see lib/tripCalculations.js)
    settlement: {
      totalDieselLitres: Number,
      totalDieselValue: Number,
      totalKm: Number,
      mileage: Number, // km per litre
      totalOtherExpenses: Number, // everything except diesel
      balance: Number, // advance - totalOtherExpenses
    },
  },
  { timestamps: true }
);

export const LOADING_LOCATION_OPTIONS = LOADING_LOCATIONS;
export const UNLOADING_LOCATION_OPTIONS = UNLOADING_LOCATIONS;

export default mongoose.models.Trip || mongoose.model("Trip", TripSchema);
