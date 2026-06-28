"use strict";

const mongoose = require("mongoose");

const VARIANTS = ["success", "error", "info", "warning"];
const CATEGORIES = [
  "membership_expiring",
  "membership_expired",
  "payment_pending",
  "payment_success",
  "new_member",
  "approval_approved",
  "approval_rejected",
  "general",
];

const notificationSchema = new mongoose.Schema(
  {
    // Who this notification belongs to (null = broadcast to all Admins)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    // Role audience — if set, all users of this role can see it
    roleAudience: {
      type: String,
      enum: ["Admin", "Trainer", "Member", null],
      default: null,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [500, "Message too long"],
    },
    variant: {
      type: String,
      enum: VARIANTS,
      default: "info",
    },
    category: {
      type: String,
      enum: CATEGORIES,
      default: "general",
    },
    memberId: { type: String, default: "" },
    memberName: { type: String, default: "" },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Index for fast per-user queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ roleAudience: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
