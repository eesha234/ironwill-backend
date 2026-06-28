"use strict";

const express = require("express");
const router = express.Router();

const {
  listUsers,
  getUser,
  updateUserStatus,
  toggleActive,
  deleteUser,
} = require("../controllers/admin.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// All admin routes are Admin-only
router.use(protect, requireRole("Admin"));

router.get("/users", listUsers);
router.get("/users/:userId", getUser);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/:userId/toggle-active", toggleActive);
router.delete("/users/:userId", deleteUser);

module.exports = router;
