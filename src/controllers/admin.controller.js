"use strict";

const User = require("../models/User");
const Member = require("../models/Member");
const Trainer = require("../models/Trainer");
const { sendSuccess, sendError } = require("../utils/response");
const { updateStatusSchema, validate } = require("../validators/approvals.validators");

// ─── GET /api/admin/users ──────────────────────────────────────────────────────

/**
 * List all users. Supports ?role= and ?accountStatus= filters.
 * Admin-only.
 */
async function listUsers(req, res, next) {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;

    const users = await User.find(filter)
      .select("-password -refreshToken")
      .sort({ createdAt: -1 })
      .lean();

    const shaped = users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      phone: u.phone,
      photo: u.photo,
      role: u.role,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt.toISOString(),
    }));

    return sendSuccess(res, shaped);
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/admin/users/:userId ─────────────────────────────────────────────

async function getUser(req, res, next) {
  try {
    const user = await User.findById(req.params.userId).select("-password -refreshToken").lean();
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");

    return sendSuccess(res, {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      photo: user.photo,
      role: user.role,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/users/:userId/status ────────────────────────────────────

/**
 * Admin manually sets any accountStatus on any user.
 * Also syncs the status to the corresponding Member/Trainer profile if one exists.
 */
async function updateUserStatus(req, res, next) {
  try {
    const { value, error } = validate(updateStatusSchema, req.body);
    if (error) {
      const details = error.details.map((d) => ({ message: d.message, field: d.context?.key }));
      return sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
    }

    const { accountStatus } = value;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");

    // Prevent admin from locking themselves out
    if (user._id.toString() === req.user.id && accountStatus !== "Approved") {
      return sendError(res, "You cannot change your own account status", 400, "SELF_STATUS_CHANGE");
    }

    user.accountStatus = accountStatus;
    await user.save({ validateBeforeSave: false });

    // Sync accountStatus to linked profile
    if (user.role === "Member") {
      await Member.updateMany({ userId: user._id }, { accountStatus });
    } else if (user.role === "Trainer") {
      await Trainer.updateMany({ userId: user._id }, { accountStatus });
    }

    return sendSuccess(res, {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    }, "Account status updated");
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/admin/users/:userId/toggle-active ────────────────────────────

/**
 * Toggle Approved ↔ Suspended.
 * Shorthand for the "Active/Inactive" toggle in the Admin user list.
 */
async function toggleActive(req, res, next) {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");

    if (user._id.toString() === req.user.id) {
      return sendError(res, "You cannot deactivate your own account", 400, "SELF_STATUS_CHANGE");
    }

    const newStatus = user.accountStatus === "Approved" ? "Suspended" : "Approved";
    user.accountStatus = newStatus;
    await user.save({ validateBeforeSave: false });

    // Sync to profile
    if (user.role === "Member") {
      await Member.updateMany({ userId: user._id }, { accountStatus: newStatus });
    } else if (user.role === "Trainer") {
      await Trainer.updateMany({ userId: user._id }, { accountStatus: newStatus });
    }

    return sendSuccess(res, {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
      accountStatus: newStatus,
    }, `Account ${newStatus === "Approved" ? "activated" : "deactivated"}`);
  } catch (err) {
    next(err);
  }
}

// ─── DELETE /api/admin/users/:userId ─────────────────────────────────────────

/**
 * Hard-delete a user and their associated profile.
 * Admin cannot delete themselves.
 */
async function deleteUser(req, res, next) {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) {
      return sendError(res, "You cannot delete your own account", 400, "SELF_DELETE");
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");

    // Remove linked profile
    if (user.role === "Member") await Member.deleteMany({ userId: user._id });
    if (user.role === "Trainer") await Trainer.deleteMany({ userId: user._id });

    return sendSuccess(res, { id: userId }, "User deleted");
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, updateUserStatus, toggleActive, deleteUser };
