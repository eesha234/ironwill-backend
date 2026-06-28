"use strict";

const User = require("../models/User");
const Member = require("../models/Member");
const Trainer = require("../models/Trainer");
const Notification = require("../models/Notification");
const { sendSuccess, sendError } = require("../utils/response");
const { decisionSchema, updateStatusSchema, validate } = require("../validators/approvals.validators");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = () => new Date().toISOString().split("T")[0];

/**
 * Auto-create a Member profile when a Member account is Approved.
 * Idempotent — re-approving won't duplicate.
 */
async function autoCreateMemberProfile(user) {
  const existing = await Member.findOne({ userId: user._id });
  if (existing) return existing;

  const today = TODAY();
  const member = await Member.create({
    userId: user._id,
    photo: user.photo,
    name: user.name,
    phone: user.phone,
    email: user.email,
    joinDate: today,
    membershipStart: today,
    status: "Trial",
    accountStatus: "Approved",
    notes: "Auto-created from an approved self-service signup. Assign a plan and trainer.",
  });
  return member;
}

/**
 * Auto-create a Trainer profile when a Trainer account is Approved.
 * Idempotent — re-approving won't duplicate.
 */
async function autoCreateTrainerProfile(user) {
  const existing = await Trainer.findOne({ userId: user._id });
  if (existing) return existing;

  const trainer = await Trainer.create({
    userId: user._id,
    photo: user.photo,
    name: user.name,
    phone: user.phone,
    email: user.email,
    joinDate: TODAY(),
    status: "Active",
    accountStatus: "Approved",
    notes: "Auto-created from an approved self-service signup. Fill in remaining details.",
  });
  return trainer;
}

// ─── GET /api/approvals ───────────────────────────────────────────────────────

/**
 * List all Trainer/Member accounts (non-Admin).
 * Supports ?role=Trainer|Member and ?status=Pending|Approved|...
 * Pending accounts are sorted first, then by createdAt desc.
 */
async function listApprovals(req, res, next) {
  try {
    const filter = { role: { $in: ["Trainer", "Member"] } };

    if (req.query.role && ["Trainer", "Member"].includes(req.query.role)) {
      filter.role = req.query.role;
    }
    if (req.query.status) {
      filter.accountStatus = req.query.status;
    }

    const users = await User.find(filter)
      .select("-password -refreshToken")
      .sort({ accountStatus: 1, createdAt: -1 })
      .lean();

    // Shape to match frontend ApprovalRequest interface
    const shaped = users.map((u) => ({
      id: u._id.toString(),
      applicantId: u._id.toString(),
      applicantName: u.name,
      applicantEmail: u.email,
      role: u.role,
      status: u.accountStatus,
      requestedAt: u.createdAt.toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      photo: u.photo,
      phone: u.phone,
      notes: null,
    }));

    return sendSuccess(res, shaped);
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/approvals/:userId/decision ─────────────────────────────────────

/**
 * Admin approves or rejects a Trainer/Member signup.
 * On approval: auto-creates the corresponding Member/Trainer profile.
 */
async function makeDecision(req, res, next) {
  try {
    const { value, error } = validate(decisionSchema, req.body);
    if (error) {
      const details = error.details.map((d) => ({ message: d.message, field: d.context?.key }));
      return sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
    }

    const { decision, notes } = value;
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) return sendError(res, "User not found", 404, "USER_NOT_FOUND");
    if (user.role === "Admin") {
      return sendError(res, "Cannot change approval status of Admin accounts", 400, "INVALID_TARGET");
    }

    user.accountStatus = decision;
    await user.save({ validateBeforeSave: false });

    let profile = null;
    if (decision === "Approved") {
      if (user.role === "Member") {
        profile = await autoCreateMemberProfile(user);
      } else if (user.role === "Trainer") {
        profile = await autoCreateTrainerProfile(user);
      }
    }

    // Notify the applicant and broadcast to Admins
    const isApproved = decision === "Approved";
    await Notification.create([
      {
        // Notify the applicant directly
        userId: user._id,
        message: isApproved
          ? `Your account has been approved! You can now log in to your dashboard.`
          : `Your account signup was ${decision.toLowerCase()}. Contact the gym for more info.`,
        variant: isApproved ? "success" : "error",
        category: isApproved ? "approval_approved" : "approval_rejected",
      },
      {
        // Broadcast to all Admins
        roleAudience: "Admin",
        message: `${user.name} (${user.role}) has been ${decision.toLowerCase()}${notes ? `: ${notes}` : "."}`,
        variant: isApproved ? "success" : "warning",
        category: isApproved ? "approval_approved" : "approval_rejected",
      },
    ]);

    return sendSuccess(res, {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
      decision,
      notes,
      profileCreated: !!profile,
    }, `Account ${decision.toLowerCase()} successfully`);
  } catch (err) {
    next(err);
  }
}

module.exports = { listApprovals, makeDecision };
