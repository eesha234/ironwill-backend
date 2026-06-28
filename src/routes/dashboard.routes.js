"use strict";

const express = require("express");
const router = express.Router();
const { getDashboardStats, getDashboardRecent } = require("../controllers/dashboard.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

router.get("/stats", requireRole("Admin"), getDashboardStats);
router.get("/recent", requireRole("Admin"), getDashboardRecent);

module.exports = router;
