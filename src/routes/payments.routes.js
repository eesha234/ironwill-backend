"use strict";

const express = require("express");
const router = express.Router();
const {
  listPayments, getPayment, createPayment, updatePayment, deletePayment, getPaymentStats,
} = require("../controllers/payments.controller");
const { protect } = require("../middleware/auth.middleware");
const { requireRole, requireApproved } = require("../middleware/role.middleware");

router.use(protect, requireApproved);

router.get("/stats", requireRole("Admin"), getPaymentStats);
router.get("/", requireRole("Admin", "Member"), listPayments);
router.get("/:id", requireRole("Admin", "Member"), getPayment);
router.post("/", requireRole("Admin"), createPayment);
router.put("/:id", requireRole("Admin"), updatePayment);
router.patch("/:id", requireRole("Admin"), updatePayment);
router.delete("/:id", requireRole("Admin"), deletePayment);

module.exports = router;
