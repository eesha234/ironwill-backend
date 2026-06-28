"use strict";

/**
 * Central error handler — must be registered LAST in Express middleware chain.
 *
 * Handles:
 *  - Mongoose ValidationError (400)
 *  - Mongoose CastError / bad ObjectId (400)
 *  - MongoDB duplicate key (409)
 *  - JWT errors (401) — already handled in auth.middleware but catch here too
 *  - Everything else → 500
 */
function errorHandler(err, req, res, _next) {
  // Default
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let code = err.code || "INTERNAL_ERROR";
  let details = null;

  // Mongoose validation errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = `Invalid value for field '${err.path}'`;
  }

  // MongoDB duplicate key (e.g. unique email)
  if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE_KEY";
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field} is already in use`;
  }

  // JWT
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    code = "INVALID_TOKEN";
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_EXPIRED";
    message = "Token has expired";
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    console.error("[ERROR]", err);
  }

  return res.status(statusCode).json({
    success: false,
    error: { message, code, ...(details && { details }) },
  });
}

/**
 * Catch-all for routes that don't exist.
 */
function notFound(req, res) {
  return res.status(404).json({
    success: false,
    error: { message: `Route ${req.method} ${req.originalUrl} not found`, code: "NOT_FOUND" },
  });
}

module.exports = { errorHandler, notFound };
