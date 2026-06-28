"use strict";

const express = require("express");
const router = express.Router();

const { listApprovals, makeDecision } = require("../controllers/approvals.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole } = require("../middleware/role.middleware");

// All approvals routes are Admin-only
router.use(protect, requireRole("Admin"));

router.get("/", listApprovals);
router.post("/:userId/decision", makeDecision);

module.exports = router;
