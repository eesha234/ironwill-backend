"use strict";

const mongoose = require("mongoose");

/**
 * Member profile — created automatically when a Member account is Approved,
 * or manually by an Admin via the Members module.
 *
 * The `userId` field links back to the User (auth) document.
 * When auto-created from a signup, userId === User._id and
 * the member's _id IS set to User._id so all cross-module lookups
 * (Payments, Attendance) using memberId stay consistent.
 */
const memberSchema = new mongoose.Schema(
  {
    // ── Link to auth user (null for manually-added members) ───────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ── Personal ──────────────────────────────────────────────────────────
    photo: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    altPhone: { type: String, default: "" },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    gender: { type: String, enum: ["M", "F", "O"], default: "M" },
    emergencyContact: { type: String, default: "" },

    // ── Membership ────────────────────────────────────────────────────────
    joinDate: { type: String, default: "" },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
    planType: { type: String, default: "" },
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "Trainer", default: null },
    trainerName: { type: String, default: "" },
    membershipStart: { type: String, default: "" },
    membershipEnd: { type: String, default: "" },

    // ── Payment ───────────────────────────────────────────────────────────
    totalFees: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other", ""],
      default: "",
    },

    // ── Additional ────────────────────────────────────────────────────────
    personalTrainingEnrolled: { type: Boolean, default: false },
    medicalNotes: { type: String, default: "" },
    biometricId: { type: String, default: "" },
    deviceUserId: { type: String, default: "" },
    notes: { type: String, default: "" },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["Active", "Expired", "Suspended", "Trial"],
      default: "Trial",
    },
    accountStatus: {
      type: String,
      enum: ["Pending", "Trial", "Approved", "Rejected", "Suspended"],
      default: "Approved",
    },

    // ── Legacy fields (kept for seed data compat) ─────────────────────────
    age: { type: Number, default: 0 },
    weight: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    goal: { type: String, default: "" },
    trainer: { type: String, default: "" },
    paidAmount: { type: Number, default: 0 },
    dueDate: { type: String, default: "" },
  },
  { timestamps: true }
);

memberSchema.index({ status: 1 });
memberSchema.index({ accountStatus: 1 });
memberSchema.index({ deviceUserId: 1 });

memberSchema.methods.toPublic = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  if (obj.planId) obj.planId = obj.planId.toString();
  if (obj.trainerId) obj.trainerId = obj.trainerId.toString();
  if (obj.userId) obj.userId = obj.userId.toString();
  return obj;
};

const Member = mongoose.model("Member", memberSchema);
module.exports = Member;
