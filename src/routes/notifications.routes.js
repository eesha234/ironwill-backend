"use strict";

const express = require("express");
const router = express.Router();
const {
  listNotifications,
  createNotification,
  markRead,
  markAllRead,
  deleteNotification,
  clearAll,
} = require("../controllers/notifications.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

// All routes require a valid, approved session
router.use(protect, requireApproved);

// List / create
router.get("/", listNotifications);
router.post("/", requireRole("Admin"), createNotification);

// Bulk mark-read (must come before /:id to avoid route conflict)
router.patch("/read-all", markAllRead);

// Clear all own notifications
router.delete("/", clearAll);

// Single notification
router.patch("/:id/read", markRead);
router.delete("/:id", deleteNotification);

module.exports = router;
