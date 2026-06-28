"use strict";

const mongoose = require("mongoose");

/**
 * Trainer (StaffMember) profile — created automatically when a Trainer
 * account is Approved, or manually by an Admin via the Trainers module.
 * The `userId` field links back to the User (auth) document.
 */
const trainerSchema = new mongoose.Schema(
  {
    // ── Link to auth user (null for manually-added trainers) ──────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ── Profile ───────────────────────────────────────────────────────────
    photo: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["Head Trainer", "Trainer", "Receptionist", "Manager"],
      default: "Trainer",
    },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    shift: {
      type: String,
      enum: ["Morning", "Evening", "Full Day"],
      default: "Morning",
    },
    salary: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    specialization: { type: String, default: "" },
    notes: { type: String, default: "" },
    joinDate: { type: String, default: "" },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    accountStatus: {
      type: String,
      enum: ["Pending", "Trial", "Approved", "Rejected", "Suspended"],
      default: "Approved",
    },
  },
  { timestamps: true }
);

trainerSchema.index({ status: 1 });

trainerSchema.methods.toPublic = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  if (obj.userId) obj.userId = obj.userId.toString();
  return obj;
};

const Trainer = mongoose.model("Trainer", trainerSchema);
module.exports = Trainer;
