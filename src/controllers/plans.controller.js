"use strict";

const Plan = require("../models/Plan");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

async function listPlans(req, res, next) {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.active = req.query.active === "true";

    const plans = await Plan.find(filter).sort({ price: 1 }).lean();
    return sendSuccess(res, plans.map(toPublic));
  } catch (err) {
    next(err);
  }
}

async function getPlan(req, res, next) {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return sendError(res, "Plan not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(plan.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

async function createPlan(req, res, next) {
  try {
    const body = sanitize(req.body);
    if (!body.name || body.duration == null || body.price == null) {
      return sendError(res, "name, duration and price are required", 400, "VALIDATION_ERROR");
    }
    const plan = await Plan.create(body);
    return sendCreated(res, toPublic(plan.toObject({ virtuals: true })), "Plan created successfully");
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const body = sanitize(req.body);
    const plan = await Plan.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!plan) return sendError(res, "Plan not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(plan.toObject({ virtuals: true })), "Plan updated");
  } catch (err) {
    next(err);
  }
}

async function deletePlan(req, res, next) {
  try {
    const plan = await Plan.findByIdAndDelete(req.params.id);
    if (!plan) return sendError(res, "Plan not found", 404, "NOT_FOUND");
    return sendSuccess(res, null, "Plan deleted");
  } catch (err) {
    next(err);
  }
}

async function togglePlanActive(req, res, next) {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return sendError(res, "Plan not found", 404, "NOT_FOUND");
    plan.active = !plan.active;
    await plan.save();
    return sendSuccess(res, toPublic(plan.toObject({ virtuals: true })), "Plan toggled");
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ALLOWED_FIELDS = [
  "name", "badge", "duration", "unit", "price", "features",
  "description", "color", "recommended", "active",
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
  return result;
}

module.exports = { listPlans, getPlan, createPlan, updatePlan, deletePlan, togglePlanActive };
