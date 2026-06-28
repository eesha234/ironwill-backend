"use strict";

const Attendance = require("../models/Attendance");
const Member = require("../models/Member");
const Trainer = require("../models/Trainer");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

// ─── List ─────────────────────────────────────────────────────────────────────
async function listAttendance(req, res, next) {
  try {
    const filter = {};
    if (req.query.memberId) filter.memberId = req.query.memberId;
    if (req.query.date) filter.date = req.query.date;
    if (req.query.status) filter.status = req.query.status;

    // Members can only see their own attendance
    if (req.user.role === "Member") {
      const member = await Member.findOne({ userId: req.user.id });
      if (!member) return sendSuccess(res, []);
      filter.memberId = member._id;
    }

    // Trainer can only see attendance for their assigned members
    if (req.user.role === "Trainer") {
      const trainer = await Trainer.findOne({ userId: req.user.id });
      if (!trainer) return sendSuccess(res, []);
      const assignedMembers = await Member.find({ trainerId: trainer._id }).select("_id").lean();
      const memberIds = assignedMembers.map((m) => m._id);
      filter.memberId = { $in: memberIds };
    }

    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const records = await Attendance.find(filter)
      .sort({ date: -1, checkIn: -1 })
      .limit(limit)
      .lean();

    return sendSuccess(res, records.map(toPublic));
  } catch (err) {
    next(err);
  }
}

// ─── Get one ──────────────────────────────────────────────────────────────────
async function getAttendanceRecord(req, res, next) {
  try {
    const rec = await Attendance.findById(req.params.id);
    if (!rec) return sendError(res, "Record not found", 404, "NOT_FOUND");
    return sendSuccess(res, toPublic(rec.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Check In ─────────────────────────────────────────────────────────────────
async function checkIn(req, res, next) {
  try {
    const { memberId, memberName } = req.body;
    if (!memberId) return sendError(res, "memberId is required", 400, "VALIDATION_ERROR");

    const today = new Date().toISOString().split("T")[0];

    // Check if already checked in today
    const existing = await Attendance.findOne({
      memberId,
      date: today,
      checkOut: null,
    });
    if (existing) {
      return sendError(res, "Member is already checked in", 409, "ALREADY_CHECKED_IN");
    }

    const now = new Date();
    const checkInTime = now.toISOString();
    const hour = now.getHours();
    const status = hour >= 10 ? "Late" : "Present";

    // Resolve memberName from DB if not provided
    let resolvedName = memberName;
    if (!resolvedName) {
      const member = await Member.findById(memberId).select("name").lean();
      resolvedName = member?.name ?? "Unknown";
    }

    const record = await Attendance.create({
      memberId,
      memberName: resolvedName,
      checkIn: checkInTime,
      checkOut: null,
      duration: null,
      date: today,
      status,
    });

    return sendCreated(res, toPublic(record.toObject({ virtuals: true })), "Checked in successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Check Out ────────────────────────────────────────────────────────────────
async function checkOut(req, res, next) {
  try {
    const record = await Attendance.findById(req.params.id);
    if (!record) return sendError(res, "Record not found", 404, "NOT_FOUND");
    if (record.checkOut) return sendError(res, "Already checked out", 400, "ALREADY_CHECKED_OUT");

    const checkOutTime = new Date().toISOString();
    const duration = Math.round(
      (new Date(checkOutTime).getTime() - new Date(record.checkIn).getTime()) / 60000
    );

    record.checkOut = checkOutTime;
    record.duration = duration;
    await record.save();

    return sendSuccess(res, toPublic(record.toObject({ virtuals: true })), "Checked out successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Create (admin manual entry) ─────────────────────────────────────────────
async function createAttendance(req, res, next) {
  try {
    const { memberId, memberName, checkIn: ci, checkOut: co, date, status } = req.body;
    if (!memberId || !ci || !date) {
      return sendError(res, "memberId, checkIn, and date are required", 400, "VALIDATION_ERROR");
    }

    let resolvedName = memberName;
    if (!resolvedName) {
      const member = await Member.findById(memberId).select("name").lean();
      resolvedName = member?.name ?? "Unknown";
    }

    let duration = null;
    if (co) {
      duration = Math.round((new Date(co).getTime() - new Date(ci).getTime()) / 60000);
    }

    const record = await Attendance.create({
      memberId,
      memberName: resolvedName,
      checkIn: ci,
      checkOut: co || null,
      duration,
      date,
      status: status || "Present",
    });

    return sendCreated(res, toPublic(record.toObject({ virtuals: true })));
  } catch (err) {
    next(err);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteAttendance(req, res, next) {
  try {
    const rec = await Attendance.findByIdAndDelete(req.params.id);
    if (!rec) return sendError(res, "Record not found", 404, "NOT_FOUND");
    return sendSuccess(res, null, "Record deleted");
  } catch (err) {
    next(err);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function getAttendanceStats(req, res, next) {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [todayCount, currentlyIn, totalAllTime] = await Promise.all([
      Attendance.countDocuments({ date: today }),
      Attendance.countDocuments({ date: today, checkOut: null }),
      Attendance.countDocuments(),
    ]);

    return sendSuccess(res, { todayCount, currentlyIn, totalAllTime });
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toPublic(obj) {
  const result = { ...obj };
  result.id = (obj._id || obj.id).toString();
  result.memberId = obj.memberId ? obj.memberId.toString() : "";
  delete result._id;
  delete result.__v;
  return result;
}

module.exports = {
  listAttendance, getAttendanceRecord,
  checkIn, checkOut,
  createAttendance, deleteAttendance,
  getAttendanceStats,
};
