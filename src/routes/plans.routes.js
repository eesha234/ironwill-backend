"use strict";

const express = require("express");
const router = express.Router();
const {
  listPlans, getPlan, createPlan, updatePlan, deletePlan, togglePlanActive,
} = require("../controllers/plans.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

// All authenticated users can read plans
router.get("/", listPlans);
router.get("/:id", getPlan);

// Mutations are Admin-only
router.post("/", requireRole("Admin"), createPlan);
router.put("/:id", requireRole("Admin"), updatePlan);
router.patch("/:id", requireRole("Admin"), updatePlan);
router.patch("/:id/toggle-active", requireRole("Admin"), togglePlanActive);
router.delete("/:id", requireRole("Admin"), deletePlan);

module.exports = router;
