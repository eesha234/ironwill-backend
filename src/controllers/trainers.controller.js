"use strict";

const Trainer = require("../models/Trainer");
const Member = require("../models/Member");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

// ─── List ─────────────────────────────────────────────────────────────────────
async function listTrainers(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountStatus) filter.accountStatus = req.query.accountStatus;

    const trainers = await Trainer.find(filter).sort({ createdAt: -1 }).lean();
    return sendSuccess(res, trainers.map(toPublic));
  } catch (err) {
    next(err);
  }
}

// ─── Get one ──────────────────────────────────────────────────────────────────
async function getTrainer(req, res, next) {
  try {
    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) return sendError(res, "Trainer not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(trainer.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Get trainer's own profile (via userId) ───────────────────────────────────
async function getMyTrainerProfile(req, res, next) {
  try {
    const trainer = await Trainer.findOne({ userId: req.user.id });
    if (!trainer) return sendError(res, "Trainer profile not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(trainer.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────
async function createTrainer(req, res, next) {
  try {
    const body = sanitize(req.body);
    if (!body.name || !body.phone || !body.email) {
      return sendError(res, "name, phone and email are required", 400, "VALIDATION_ERROR");
    }
    if (!body.joinDate) body.joinDate = new Date().toISOString().split("T")[0];

    const trainer = await Trainer.create(body);
    return sendCreated(res, toPublic(trainer.toObject({ virtuals: true })), "Trainer created successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────
async function updateTrainer(req, res, next) {
  try {
    const body = sanitize(req.body);
    const trainer = await Trainer.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!trainer) return sendError(res, "Trainer not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(trainer.toObject({ virtuals: true })), "Trainer updated");
  } catch (err) {
    next(err);
  }
}

// ─── Toggle active ────────────────────────────────────────────────────────────
async function toggleTrainerActive(req, res, next) {
  try {
    const trainer = await Trainer.findById(req.params.id);
    if (!trainer) return sendError(res, "Trainer not found", 404, "NOT_FOUND");
    trainer.status = trainer.status === "Active" ? "Inactive" : "Active";
    await trainer.save();
    return sendSuccess(res, toPublic(trainer.toObject({ virtuals: true })), "Trainer status toggled");
  } catch (err) {
    next(err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteTrainer(req, res, next) {
  try {
    const trainer = await Trainer.findByIdAndDelete(req.params.id);
    if (!trainer) return sendError(res, "Trainer not found", 404, "NOT_FOUND");
    return sendSuccess(res, null, "Trainer deleted");
  } catch (err) {
    next(err);
  }
}

// ─── Get assigned members ─────────────────────────────────────────────────────
async function getTrainerMembers(req, res, next) {
  try {
    let trainerId = req.params.id;

    // If trainer is viewing their own members, resolve by userId
    if (req.params.id === "me") {
      const trainer = await Trainer.findOne({ userId: req.user.id });
      if (!trainer) return sendSuccess(res, []);
      trainerId = trainer._id.toString();
    }

    const members = await Member.find({ trainerId }).sort({ createdAt: -1 }).lean();
    return sendSuccess(res, members.map(memberToPublic));
  } catch (err) {
    next(err);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getTrainerStats(req, res, next) {
  try {
    const [total, active] = await Promise.all([
      Trainer.countDocuments(),
      Trainer.countDocuments({ status: "Active" }),
    ]);
    return sendSuccess(res, { total, active });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ALLOWED_FIELDS = [
  "userId", "photo", "name", "role", "phone", "email", "shift",
  "salary", "experience", "specialization", "notes", "joinDate", "status", "accountStatus",
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
  if (result.userId) result.userId = result.userId.toString();
  return result;
}

function memberToPublic(obj) {
  const result = { ...obj };
  result.id = (obj._id || obj.id).toString();
  delete result._id;
  delete result.__v;
  if (result.planId) result.planId = result.planId.toString();
  if (result.trainerId) result.trainerId = result.trainerId.toString();
  if (result.userId) result.userId = result.userId.toString();
  return result;
}

module.exports = {
  listTrainers, getTrainer, getMyTrainerProfile, createTrainer,
  updateTrainer, toggleTrainerActive, deleteTrainer,
  getTrainerMembers, getTrainerStats,
};
