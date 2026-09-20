const mongoose = require('mongoose');

// Small key/value store for app-wide settings edited by the super admin (route KM table, mobile
// app download link). Lives in Mongo because the server's disk is wiped on every redeploy.
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model('Setting', settingSchema);
