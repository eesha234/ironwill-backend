"use strict";

const Member = require("../models/Member");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

// ─── List ─────────────────────────────────────────────────────────────────────
async function listMembers(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;
    if (req.query.trainerId) filter.trainerId = req.query.trainerId;

    // Trainer can only see their own assigned members
    if (req.user.role === "Trainer") {
      const Trainer = require("../models/Trainer");
      const trainerProfile = await Trainer.findOne({ userId: req.user.id });
      if (!trainerProfile) return sendSuccess(res, []);
      filter.trainerId = trainerProfile._id;
    }

    const members = await Member.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return sendSuccess(res, members.map(toPublic));
  } catch (err) {
    next(err);
  }
}

// ─── Get one ──────────────────────────────────────────────────────────────────
async function getMember(req, res, next) {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return sendError(res, "Member not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(member.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────
async function createMember(req, res, next) {
  try {
    const body = sanitize(req.body);
    if (!body.name || !body.phone || !body.email) {
      return sendError(res, "name, phone and email are required", 400, "VALIDATION_ERROR");
    }

    // Set joinDate if not provided
    if (!body.joinDate) body.joinDate = new Date().toISOString().split("T")[0];

    const member = await Member.create(body);
    return sendCreated(res, toPublic(member.toObject({ virtuals: true })), "Member created successfully");
  } catch (err) {
    if (err.code === 11000) return sendError(res, "Duplicate entry", 409, "DUPLICATE");
    next(err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────
async function updateMember(req, res, next) {
  try {
    const body = sanitize(req.body);
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!member) return sendError(res, "Member not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(member.toObject({ virtuals: true })), "Member updated");
  } catch (err) {
    next(err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteMember(req, res, next) {
  try {
    const member = await Member.findByIdAndDelete(req.params.id);
    if (!member) return sendError(res, "Member not found", 404, "NOT_FOUND");
    return sendSuccess(res, null, "Member deleted");
  } catch (err) {
    next(err);
  }
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
async function getMemberStats(req, res, next) {
  try {
    const [total, active, expired, trial] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: "Active" }),
      Member.countDocuments({ status: "Expired" }),
      Member.countDocuments({ status: "Trial" }),
    ]);
    return sendSuccess(res, { total, active, expired, trial });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ALLOWED_FIELDS = [
  "userId", "photo", "name", "phone", "altPhone", "email", "address",
  "dateOfBirth", "gender", "emergencyContact", "joinDate", "planId", "planType",
  "trainerId", "trainerName", "membershipStart", "membershipEnd", "totalFees",
  "amountPaid", "paymentMode", "personalTrainingEnrolled", "medicalNotes",
  "biometricId", "deviceUserId", "notes", "status", "accountStatus",
  "age", "weight", "height", "goal", "trainer", "paidAmount", "dueDate",
];

function sanitize(body) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

function toPublic(obj) {
  const result = { ...obj };
  result.id = (obj._id || obj.id).toString();
  delete result._id;
  delete result.__v;
  if (result.planId) result.planId = result.planId.toString();
  if (result.trainerId) result.trainerId = result.trainerId.toString();
  if (result.userId) result.userId = result.userId.toString();
  return result;
}

module.exports = { listMembers, getMember, createMember, updateMember, deleteMember, getMemberStats };
