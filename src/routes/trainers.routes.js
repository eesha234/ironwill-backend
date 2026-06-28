"use strict";

const express = require("express");
const router = express.Router();
const {
  listTrainers, getTrainer, getMyTrainerProfile, createTrainer,
  updateTrainer, toggleTrainerActive, deleteTrainer,
  getTrainerMembers, getTrainerStats,
} = require("../controllers/trainers.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

router.get("/stats", requireRole("Admin"), getTrainerStats);
router.get("/me", requireRole("Trainer"), getMyTrainerProfile);
router.get("/me/members", requireRole("Trainer"), getTrainerMembers);

router.get("/", requireRole("Admin", "Trainer"), listTrainers);
router.get("/:id", requireRole("Admin", "Trainer"), getTrainer);
router.get("/:id/members", requireRole("Admin", "Trainer"), getTrainerMembers);
router.post("/", requireRole("Admin"), createTrainer);
router.put("/:id", requireRole("Admin"), updateTrainer);
router.patch("/:id", requireRole("Admin"), updateTrainer);
router.patch("/:id/toggle-active", requireRole("Admin"), toggleTrainerActive);
router.delete("/:id", requireRole("Admin"), deleteTrainer);

module.exports = router;
