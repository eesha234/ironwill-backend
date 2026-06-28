"use strict";

const express = require("express");
const router = express.Router();
const {
  listMembers, getMember, createMember, updateMember, deleteMember, getMemberStats,
} = require("../controllers/members.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

// Stats — Admin only
router.get("/stats", requireRole("Admin"), getMemberStats);

// Full CRUD — Admin; Trainer can read list (filtered to their members)
router.get("/", requireRole("Admin", "Trainer"), listMembers);
router.get("/:id", requireRole("Admin", "Trainer", "Member"), getMember);
router.post("/", requireRole("Admin"), createMember);
router.put("/:id", requireRole("Admin"), updateMember);
router.patch("/:id", requireRole("Admin"), updateMember);
router.delete("/:id", requireRole("Admin"), deleteMember);

module.exports = router;
