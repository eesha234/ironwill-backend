"use strict";

const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    badge: { type: String, default: "🏋️" },
    duration: { type: Number, required: true },
    unit: { type: String, enum: ["day", "month", "months"], default: "months" },
    price: { type: Number, required: true, min: 0 },
    features: { type: [String], default: [] },
    description: { type: String, default: "" },
    color: { type: String, default: "#22d3ee" },
    recommended: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

planSchema.index({ active: 1 });

planSchema.methods.toPublic = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Plan = mongoose.model("Plan", planSchema);
module.exports = Plan;
