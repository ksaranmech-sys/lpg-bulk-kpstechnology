const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/constants');

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
    role: { type: String, enum: Object.values(ROLES), required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: function () {
      return this.role !== ROLES.SUPER_ADMIN;
    } },
    // Only set (and only meaningful) when role === 'vehicle_user'
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

userSchema.methods.checkPassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.methods.toSafeJSON = function () {
  const customerId = this.customer && typeof this.customer === 'object' ? (this.customer._id || this.customer.toString()) : this.customer;
  const vehicleId = this.vehicle && typeof this.vehicle === 'object' ? (this.vehicle._id || this.vehicle.toString()) : this.vehicle;

  return {
    id: this._id,
    username: this.username,
    name: this.name,
    mobileNumber: this.mobileNumber,
    joiningDate: this.joiningDate,
    resigningDate: this.resigningDate,
    basicSalary: this.basicSalary,
    kmCharges: this.kmCharges,
    minKmCharges: this.minKmCharges,
    specialCharges: this.specialCharges,
    role: this.role,
    customer: customerId,
    vehicle: vehicleId,
    isActive: this.isActive,
  };
};

module.exports = mongoose.model('User', userSchema);
