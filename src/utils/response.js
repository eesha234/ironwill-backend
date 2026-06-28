"use strict";

/**
 * All responses follow the same envelope:
 *
 *   { success: true,  data: <payload>,       message?: string }
 *   { success: false, error: { message, code?, details? } }
 */

function sendSuccess(res, data, message = "OK", statusCode = 200) {
  const body = { success: true, data };
  if (message && message !== "OK") body.message = message;
  return res.status(statusCode).json(body);
}

function sendCreated(res, data, message = "Created") {
  return sendSuccess(res, data, message, 201);
}

function sendError(res, message, statusCode = 500, code = null, details = null) {
  const error = { message };
  if (code) error.code = code;
  if (details) error.details = details;
  return res.status(statusCode).json({ success: false, error });
}

module.exports = { sendSuccess, sendCreated, sendError };
