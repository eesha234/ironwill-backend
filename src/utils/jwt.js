"use strict";

const jwt = require("jsonwebtoken");

/**
 * Sign a short-lived access token.
 * Payload: { id, role, accountStatus }
 */
function signAccessToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, accountStatus: user.accountStatus },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );
}

/**
 * Sign a long-lived refresh token.
 * Payload: { id } only — minimal surface area.
 */
function signRefreshToken(user) {
  return jwt.sign(
    { id: user._id.toString() },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );
}

/**
 * Verify an access token.
 * Throws JsonWebTokenError / TokenExpiredError on failure.
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

/**
 * Verify a refresh token.
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
