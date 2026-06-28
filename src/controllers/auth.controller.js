"use strict";

const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");
const { signupSchema, loginSchema, validate } = require("../validators/auth.validators");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Set the refresh token as an httpOnly cookie so JS can't read it.
 * Access token is returned in the JSON body and stored in memory by the client.
 */
function setRefreshCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });
}

// ─── Signup ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 *
 * Admin accounts → accountStatus: "Approved" (instant access).
 * Trainer/Member → accountStatus: "Pending" (must await Admin approval).
 */
async function signup(req, res, next) {
  try {
    const { value, error } = validate(signupSchema, req.body);
    if (error) {
      const details = error.details.map((d) => ({ message: d.message, field: d.context?.key }));
      return sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
    }

    const { name, email, phone, photo, password, role, adminCode } = value;

    // Validate admin secret code server-side
    if (role === "Admin") {
      if (adminCode !== process.env.ADMIN_SECRET_CODE) {
        return sendError(res, "Invalid admin access code", 403, "INVALID_ADMIN_CODE");
      }
    }

    // Check duplicate email
    const exists = await User.findOne({ email });
    if (exists) {
      return sendError(res, "Email is already registered", 409, "DUPLICATE_EMAIL");
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      photo: photo || null,
      password, // hashed by pre-save hook
      role,
      accountStatus: role === "Admin" ? "Approved" : "Pending",
    });

    return sendCreated(res, user.toPublic(), "Account created successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 *
 * Returns: { accessToken, user }
 * Sets: httpOnly refreshToken cookie
 */
async function login(req, res, next) {
  try {
    const { value, error } = validate(loginSchema, req.body);
    if (error) {
      return sendError(res, "Email and password are required", 400, "VALIDATION_ERROR");
    }

    const { email, password } = value;

    // Fetch user including password (select: false by default)
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return sendError(res, "Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return sendError(res, "Invalid email or password", 401, "INVALID_CREDENTIALS");
    }

    // Rejected accounts cannot log in at all
    if (user.accountStatus === "Rejected") {
      return sendError(
        res,
        "Your account has been rejected. Please contact the gym admin.",
        403,
        "ACCOUNT_REJECTED"
      );
    }

    // Suspended accounts cannot log in
    if (user.accountStatus === "Suspended") {
      return sendError(
        res,
        "Your account has been suspended. Please contact the gym admin.",
        403,
        "ACCOUNT_SUSPENDED"
      );
    }

    // Issue tokens
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    // Hash and store refresh token
    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(refreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, refreshToken);

    return sendSuccess(res, { accessToken, user: user.toPublic() }, "Login successful");
  } catch (err) {
    next(err);
  }
}

// ─── Logout ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Protected — requires valid access token.
 * Clears the stored refresh token so the cookie is invalidated server-side.
 */
async function logout(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    clearRefreshCookie(res);
    return sendSuccess(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
}

// ─── Refresh Token ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/refresh
 * Reads the httpOnly refreshToken cookie, validates it against the stored hash,
 * then issues a new access token + rotates the refresh token.
 */
async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return sendError(res, "Refresh token not found", 401, "NO_REFRESH_TOKEN");
    }

    // Verify JWT signature / expiry
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      clearRefreshCookie(res);
      return sendError(res, "Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
    }

    // Fetch user with their stored (hashed) refresh token
    const user = await User.findById(payload.id).select("+refreshToken");
    if (!user || !user.refreshToken) {
      clearRefreshCookie(res);
      return sendError(res, "Session not found. Please log in again.", 401, "SESSION_NOT_FOUND");
    }

    // Compare incoming token with stored hash
    const valid = await bcrypt.compare(token, user.refreshToken);
    if (!valid) {
      // Possible token reuse attack — clear the stored token
      user.refreshToken = null;
      await user.save({ validateBeforeSave: false });
      clearRefreshCookie(res);
      return sendError(res, "Refresh token reuse detected. Please log in again.", 401, "TOKEN_REUSE");
    }

    // Rotate tokens
    const newAccessToken = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);

    const salt = await bcrypt.genSalt(10);
    user.refreshToken = await bcrypt.hash(newRefreshToken, salt);
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefreshToken);

    return sendSuccess(res, { accessToken: newAccessToken, user: user.toPublic() }, "Token refreshed");
  } catch (err) {
    next(err);
  }
}

// ─── Get current user (me) ────────────────────────────────────────────────────

/**
 * GET /api/auth/me
 * Protected. Returns the logged-in user's public profile.
 */
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return sendError(res, "User not found", 404, "USER_NOT_FOUND");
    }
    return sendSuccess(res, user.toPublic());
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, logout, refresh, getMe };
