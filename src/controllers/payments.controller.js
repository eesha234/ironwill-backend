"use strict";

const Payment = require("../models/Payment");
const Member = require("../models/Member");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

// ─── List ─────────────────────────────────────────────────────────────────────
async function listPayments(req, res, next) {
  try {
    const filter = {};
    if (req.query.memberId) filter.memberId = req.query.memberId;
    if (req.query.status) filter.status = req.query.status;

    // Members can only see their own payments
    if (req.user.role === "Member") {
      const member = await Member.findOne({ userId: req.user.id });
      if (!member) return sendSuccess(res, []);
      filter.memberId = member._id;
    }

    const payments = await Payment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).lean();
    return sendSuccess(res, payments.map(toPublic));
  } catch (err) {
    next(err);
  }
}

// ─── Get one ──────────────────────────────────────────────────────────────────
async function getPayment(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return sendError(res, "Payment not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(payment.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Create ───────────────────────────────────────────────────────────────────
async function createPayment(req, res, next) {
  try {
    const body = sanitize(req.body);
    if (!body.memberId || !body.amount || !body.paymentDate) {
      return sendError(res, "memberId, amount and paymentDate are required", 400, "VALIDATION_ERROR");
    }

    const payment = await Payment.create(body);

    // ── Cross-module: update Member's amountPaid when status is Paid ──────
    if (payment.status === "Paid") {
      await syncMemberPayment(payment.memberId, payment.amount, payment.paymentMode);
    }

    return sendCreated(res, toPublic(payment.toObject({ virtuals: true })), "Payment recorded");
  } catch (err) {
    next(err);
  }
}

// ─── Update ───────────────────────────────────────────────────────────────────
async function updatePayment(req, res, next) {
  try {
    const existing = await Payment.findById(req.params.id);
    if (!existing) return sendError(res, "Payment not found", 404, "NOT_FOUND");

    const wasPaid = existing.status === "Paid";
    const body = sanitize(req.body);

    const payment = await Payment.findByIdAndUpdate(
      req.params.id,
      { $set: body },
      { new: true, runValidators: true }
    );

    // ── Cross-module: recalculate if payment status changed ────────────────
    const isNowPaid = payment.status === "Paid";
    if (!wasPaid && isNowPaid) {
      // Became paid — add the amount
      await syncMemberPayment(payment.memberId, payment.amount, payment.paymentMode);
    } else if (wasPaid && !isNowPaid) {
      // Was paid, now not — subtract the old amount
      await syncMemberPayment(payment.memberId, -existing.amount, existing.paymentMode);
    }

    return sendSuccess(res, toPublic(payment.toObject({ virtuals: true })), "Payment updated");
  } catch (err) {
    next(err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deletePayment(req, res, next) {
  try {
    const payment = await Payment.findByIdAndDelete(req.params.id);
    if (!payment) return sendError(res, "Payment not found", 404, "NOT_FOUND");

    // If it was Paid, reverse the member's amountPaid
    if (payment.status === "Paid") {
      await syncMemberPayment(payment.memberId, -payment.amount, null);
    }

    return sendSuccess(res, null, "Payment deleted");
  } catch (err) {
    next(err);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getPaymentStats(req, res, next) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = today.slice(0, 7);

    const [allPaid, monthPaid, todayPaid, pending, overdue] = await Promise.all([
      Payment.aggregate([{ $match: { status: "Paid" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Payment.aggregate([
        { $match: { status: "Paid", paymentDate: { $regex: `^${thisMonth}` } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.aggregate([
        { $match: { status: "Paid", paymentDate: today } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Payment.countDocuments({ status: "Pending" }),
      Payment.countDocuments({ status: "Overdue" }),
    ]);

    return sendSuccess(res, {
      totalRevenue: allPaid[0]?.total ?? 0,
      monthlyRevenue: monthPaid[0]?.total ?? 0,
      todayRevenue: todayPaid[0]?.total ?? 0,
      pendingCount: pending,
      overdueCount: overdue,
    });
  } catch (err) {
    next(err);
  }
}

// ─── Cross-module helper: sync Member.amountPaid ──────────────────────────────
async function syncMemberPayment(memberId, delta, paymentMode) {
  try {
    const update = { $inc: { amountPaid: delta, paidAmount: delta } };
    if (paymentMode) update.$set = { paymentMode };
    await Member.findByIdAndUpdate(memberId, update);
  } catch (err) {
    console.error("[Payments] Failed to sync member payment:", err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ALLOWED_FIELDS = [
  "memberId", "memberName", "membershipPlan", "amount", "paymentDate",
  "paymentMode", "transactionRef", "status", "notes",
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
  result.memberId = obj.memberId ? obj.memberId.toString() : "";
  result.createdAt = obj.createdAt
    ? (typeof obj.createdAt === "string" ? obj.createdAt : obj.createdAt.toISOString())
    : new Date().toISOString();
  delete result._id;
  delete result.__v;
  return result;
}

module.exports = { listPayments, getPayment, createPayment, updatePayment, deletePayment, getPaymentStats };
