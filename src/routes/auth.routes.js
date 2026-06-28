"use strict";

const express = require("express");
const router = express.Router();

const { signup, login, logout, refresh, getMe } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");

// Public
router.post("/signup", signup);
router.post("/login", login);
router.post("/refresh", refresh);

// Protected
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

module.exports = router;
