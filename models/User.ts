// @ts-nocheck
import mongoose from "mongoose";

/**
 * Roles:
 *  - "superadmin" : KPS Technology staff. Creates customer accounts.
 *  - "admin"      : Customer's admin login. Full access to ALL vehicles under their customerId.
 *  - "user"       : Customer's restricted login. Access to exactly ONE vehicle (assignedVehicle).
 */
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["superadmin", "admin", "driver", "user"], required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" }, // null for superadmin
    assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" }, // optional for customer-scoped driver logins
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", UserSchema);
