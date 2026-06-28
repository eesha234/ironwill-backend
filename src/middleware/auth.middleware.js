"use strict";

const { verifyAccessToken } = require("../utils/jwt");
const { sendError } = require("../utils/response");

/**
 * Middleware: require a valid JWT access token.
 * Attaches decoded payload as req.user = { id, role, accountStatus }.
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Access token required", 401, "NO_TOKEN");
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return sendError(res, "Access token expired", 401, "TOKEN_EXPIRED");
    }
    return sendError(res, "Invalid access token", 401, "INVALID_TOKEN");
  }
}

module.exports = { protect };
