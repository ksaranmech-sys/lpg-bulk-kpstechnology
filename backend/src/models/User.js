const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

// Covers this driver's vehicle while they're on leave/vacation - joining/returning dates are
// independent of any Leave record so a substitute can be assigned without one.
const temporaryDriverSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    name: { type: String, trim: true, default: null },
    joiningDate: { type: Date, default: null },
    returningDate: { type: Date, default: null },
  },
  { _id: false }
);

/**
 * A User logs in with username + password (created by KPS admin or the
 * customer admin — end customers do not self-register).
 *
 * role = 'customer_admin' -> full access to every vehicle under `customer`
 * role = 'vehicle_user'   -> access restricted to the single `vehicle` below
 * role = 'super_admin'    -> KPS Technology staff, cross-customer access
 */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    joiningDate: { type: Date, default: null },
    resigningDate: { type: Date, default: null },
    basicSalary: { type: Number, min: 0, default: 0 },
    kmCharges: { type: Number, min: 0, default: 0 },
    minKmCharges: { type: Number, min: 0, default: 0 },
    specialCharges: { type: Boolean, default: false },
    // Only meaningful for role === 'vehicle_user' - set while the regular driver is on
    // vacation and a substitute is covering their vehicle.
    temporaryDriver: { type: temporaryDriverSchema, default: () => ({}) },
    role: { type: String, enum: Object.values(ROLES), required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: function () {
      return this.role !== ROLES.SUPER_ADMIN;
    } },
    // Only set (and only meaningful) when role === 'vehicle_user'
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    // Bumped to invalidate every outstanding refresh token (logout everywhere, password reset).
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Customer pages list users per customer; vehicle lookups find the active driver per vehicle.
userSchema.index({ customer: 1, role: 1 });
userSchema.index({ vehicle: 1, isActive: 1 });

userSchema.methods.setPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

userSchema.methods.checkPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// The temporary driver shares this account's login - while their assignment is active (on or
// after joiningDate, and on or before returningDate if it's been set), their name should be
// shown instead of the regular driver's for identification purposes.
userSchema.methods.getDisplayName = function (now = new Date()) {
  const temp = this.temporaryDriver;
  const isActive = Boolean(
    temp?.required &&
    temp?.joiningDate &&
    new Date(temp.joiningDate) <= now &&
    (!temp.returningDate || new Date(temp.returningDate) >= now)
  );
  return isActive ? temp.name : this.name;
};

userSchema.methods.toSafeJSON = function () {
  const customerId = this.customer && typeof this.customer === 'object' ? (this.customer._id || this.customer.toString()) : this.customer;
  const vehicleId = this.vehicle && typeof this.vehicle === 'object' ? (this.vehicle._id || this.vehicle.toString()) : this.vehicle;

  return {
    id: this._id,
    username: this.username,
    name: this.name,
    displayName: this.getDisplayName(),
    mobileNumber: this.mobileNumber,
    joiningDate: this.joiningDate,
    resigningDate: this.resigningDate,
    basicSalary: this.basicSalary,
    kmCharges: this.kmCharges,
    minKmCharges: this.minKmCharges,
    specialCharges: this.specialCharges,
    temporaryDriver: this.temporaryDriver,
    role: this.role,
    customer: customerId,
    vehicle: vehicleId,
    isActive: this.isActive,
  };
};

module.exports = mongoose.model('User', userSchema);
