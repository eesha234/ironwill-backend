"use strict";

const Member = require("../models/Member");
const Trainer = require("../models/Trainer");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");
const { sendSuccess } = require("../utils/response");

/**
 * GET /api/dashboard/stats
 * Admin-only: returns aggregated stats for dashboard cards.
 */
async function getDashboardStats(req, res, next) {
  try {
    const today = new Date().toISOString().split("T")[0];
    const thisMonth = today.slice(0, 7);

    const [
      totalMembers,
      activeMembers,
      expiredMembers,
      trialMembers,
      totalTrainers,
      activeTrainers,
      revenueAgg,
      monthRevenueAgg,
      todayRevenueAgg,
      pendingPayments,
      overduePayments,
      todayAttendance,
      currentlyIn,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: "Active" }),
      Member.countDocuments({ status: "Expired" }),
      Member.countDocuments({ status: "Trial" }),
      Trainer.countDocuments(),
      Trainer.countDocuments({ status: "Active" }),
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
      Attendance.countDocuments({ date: today }),
      Attendance.countDocuments({ date: today, checkOut: null }),
    ]);

    return sendSuccess(res, {
      members: {
        total: totalMembers,
        active: activeMembers,
        expired: expiredMembers,
        trial: trialMembers,
      },
      trainers: {
        total: totalTrainers,
        active: activeTrainers,
      },
      payments: {
        totalRevenue: revenueAgg[0]?.total ?? 0,
        monthlyRevenue: monthRevenueAgg[0]?.total ?? 0,
        todayRevenue: todayRevenueAgg[0]?.total ?? 0,
        pendingCount: pendingPayments,
        overdueCount: overduePayments,
      },
      attendance: {
        todayCount: todayAttendance,
        currentlyIn,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/dashboard/recent
 * Admin-only: recent members, payments, and today's attendance for dashboard tables.
 */
async function getDashboardRecent(req, res, next) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [recentMembers, recentPayments, todayAttendance] = await Promise.all([
      Member.find().sort({ createdAt: -1 }).limit(5).lean(),
      Payment.find().sort({ createdAt: -1 }).limit(5).lean(),
      Attendance.find({ date: today }).sort({ checkIn: -1 }).limit(10).lean(),
    ]);

    return sendSuccess(res, {
      recentMembers: recentMembers.map(memberToPublic),
      recentPayments: recentPayments.map(paymentToPublic),
      todayAttendance: todayAttendance.map(attendanceToPublic),
    });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function memberToPublic(obj) {
  const r = { ...obj };
  r.id = (obj._id || obj.id).toString();
  delete r._id; delete r.__v;
  if (r.planId) r.planId = r.planId.toString();
  if (r.trainerId) r.trainerId = r.trainerId.toString();
  if (r.userId) r.userId = r.userId.toString();
  return r;
}

function paymentToPublic(obj) {
  const r = { ...obj };
  r.id = (obj._id || obj.id).toString();
  r.memberId = obj.memberId ? obj.memberId.toString() : "";
  r.createdAt = obj.createdAt instanceof Date ? obj.createdAt.toISOString() : obj.createdAt;
  delete r._id; delete r.__v;
  return r;
}

function attendanceToPublic(obj) {
  const r = { ...obj };
  r.id = (obj._id || obj.id).toString();
  r.memberId = obj.memberId ? obj.memberId.toString() : "";
  delete r._id; delete r.__v;
  return r;
}

module.exports = { getDashboardStats, getDashboardRecent };
