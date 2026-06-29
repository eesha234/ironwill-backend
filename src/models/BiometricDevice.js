"use strict";
const mongoose = require("mongoose");

const biometricDeviceSchema = new mongoose.Schema(
  {
    deviceName: { type: String, required: true, trim: true },
    serialNumber: { type: String, required: true, unique: true, trim: true },
    brand: { type: String, default: "eSSL" },
    model: { type: String, default: "X2008" },
    location: { type: String, default: "Reception" },
    isActive: { type: Boolean, default: true },
    lastSync: { type: Date, default: null },
    firmwareVersion: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BiometricDevice", biometricDeviceSchema);