"use strict";

const express = require("express");
const router = express.Router();
const {
  listAttendance, getAttendanceRecord,
  checkIn, checkOut,
  createAttendance, deleteAttendance,
  getAttendanceStats,
} = require("../controllers/attendance.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

router.get("/stats", requireRole("Admin"), getAttendanceStats);
router.get("/", requireRole("Admin", "Trainer", "Member"), listAttendance);
router.get("/:id", requireRole("Admin", "Trainer", "Member"), getAttendanceRecord);

// Check-in / Check-out (admin-initiated or kiosk flow)
router.post("/checkin", requireRole("Admin", "Trainer"), checkIn);
router.patch("/:id/checkout", requireRole("Admin", "Trainer"), checkOut);

// Manual entry (admin)
router.post("/", requireRole("Admin"), createAttendance);
router.delete("/:id", requireRole("Admin"), deleteAttendance);

module.exports = router;
