"use strict";

const { sendError } = require("../utils/response");

/**
 * Gate a route to one or more roles.
 *
 * Usage:
 *   router.get("/admin-only", protect, requireRole("Admin"), handler)
 *   router.get("/staff",      protect, requireRole("Admin", "Trainer"), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "Not authenticated", 401, "NO_TOKEN");
    }
    if (!roles.includes(req.user.role)) {
      return sendError(res, "Forbidden: insufficient role", 403, "FORBIDDEN");
    }
    next();
  };
}

/**
 * Require that the authenticated user's account is Approved.
 * Admin accounts are always Approved at creation.
 * Trainers/Members must wait for Admin sign-off.
 */
function requireApproved(req, res, next) {
  if (!req.user) {
    return sendError(res, "Not authenticated", 401, "NO_TOKEN");
  }
  if (req.user.accountStatus !== "Approved") {
    return sendError(
      res,
      "Your account is pending approval. Please wait for an Admin to approve your account.",
      403,
      "ACCOUNT_NOT_APPROVED"
    );
  }
  next();
}

module.exports = { requireRole, requireApproved };
