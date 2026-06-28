"use strict";

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Member",
      required: true,
      index: true,
    },
    memberName: { type: String, required: true, trim: true },
    membershipPlan: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    paymentDate: { type: String, required: true }, // ISO date YYYY-MM-DD
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Bank Transfer", "Other", null],
      default: null,
    },
    transactionRef: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Overdue"],
      default: "Pending",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

paymentSchema.index({ status: 1 });
paymentSchema.index({ paymentDate: 1 });

paymentSchema.methods.toPublic = function () {
  const obj = this.toObject({ virtuals: true });
  obj.id = obj._id.toString();
  obj.memberId = obj.memberId.toString();
  obj.createdAt = obj.createdAt.toISOString();
  delete obj._id;
  delete obj.__v;
  return obj;
};

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;
