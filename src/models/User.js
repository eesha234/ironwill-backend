"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ─── Constants (mirror frontend enums) ───────────────────────────────────────
const ROLES = ["Admin", "Trainer", "Member"];
const ACCOUNT_STATUSES = ["Pending", "Trial", "Approved", "Rejected", "Suspended"];

const userSchema = new mongoose.Schema(
  {
    // ── Core identity ──────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be at most 60 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    phone: {
      type: String,
      required: [true, "Phone is required"],
      trim: true,
    },
    // Stored as a Cloudinary URL (Phase 2+). Null until uploaded.
    photo: {
      type: String,
      default: null,
    },

    // ── Auth ───────────────────────────────────────────────────────────────
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false, // never returned in queries by default
    },
    /**
     * Stored refresh token (hashed).
     * A single active session per user — rotating on each /refresh call.
     * Cleared on logout.
     */
    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    // ── Role & Status ──────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ROLES,
      required: [true, "Role is required"],
    },
    /**
     * Admin accounts are set to "Approved" at signup.
     * Trainer/Member start as "Pending" and require Admin approval.
     */
    accountStatus: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: "Pending",
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ role: 1, accountStatus: 1 });

// ─── Pre-save: hash password ──────────────────────────────────────────────────
userSchema.pre("save", async function (next) {
  // Only re-hash if the password field was actually modified
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance method: compare password ───────────────────────────────────────
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// ─── Instance method: safe public representation ──────────────────────────────
userSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    phone: this.phone,
    photo: this.photo,
    role: this.role,
    accountStatus: this.accountStatus,
    createdAt: this.createdAt.toISOString(),
  };
};

const User = mongoose.model("User", userSchema);
module.exports = User;
