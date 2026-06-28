"use strict";

const Notification = require("../models/Notification");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

/**
 * Build a Mongoose query filter that returns notifications visible to req.user.
 * A notification is visible if:
 *   - userId matches this user, OR
 *   - roleAudience matches this user's role
 */
function visibilityFilter(user) {
  return {
    $or: [
      { userId: user.id },
      { roleAudience: user.role },
    ],
  };
}

// ── GET /api/notifications ───────────────────────────────────────────────────
async function listNotifications(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const unreadOnly = req.query.unread === "true";

    const filter = visibilityFilter(req.user);
    if (unreadOnly) filter.read = false;

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await Notification.countDocuments({
      ...visibilityFilter(req.user),
      read: false,
    });

    return sendSuccess(res, {
      notifications: notifications.map(toPublic),
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/notifications ──────────────────────────────────────────────────
// Admin only — create a notification (broadcast or targeted)
async function createNotification(req, res, next) {
  try {
    const { message, variant, category, memberId, memberName, userId, roleAudience } = req.body;

    if (!message) {
      return sendError(res, "message is required", 400, "VALIDATION_ERROR");
    }

    const notification = await Notification.create({
      userId: userId || null,
      roleAudience: roleAudience || null,
      message,
      variant: variant || "info",
      category: category || "general",
      memberId: memberId || "",
      memberName: memberName || "",
    });

    return sendCreated(res, toPublic(notification.toObject()));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/notifications/:id/read ───────────────────────────────────────
async function markRead(req, res, next) {
  try {
    const filter = { _id: req.params.id, ...visibilityFilter(req.user) };
    const notification = await Notification.findOneAndUpdate(
      filter,
      { read: true },
      { new: true }
    ).lean();

    if (!notification) {
      return sendError(res, "Notification not found", 404, "NOT_FOUND");
    }
    return sendSuccess(res, toPublic(notification));
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/notifications/read-all ───────────────────────────────────────
async function markAllRead(req, res, next) {
  try {
    await Notification.updateMany(
      { ...visibilityFilter(req.user), read: false },
      { read: true }
    );
    return sendSuccess(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/notifications/:id ───────────────────────────────────────────
async function deleteNotification(req, res, next) {
  try {
    const filter = { _id: req.params.id, ...visibilityFilter(req.user) };
    const notification = await Notification.findOneAndDelete(filter);
    if (!notification) {
      return sendError(res, "Notification not found", 404, "NOT_FOUND");
    }
    return sendSuccess(res, { id: req.params.id });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/notifications ────────────────────────────────────────────────
async function clearAll(req, res, next) {
  try {
    await Notification.deleteMany(visibilityFilter(req.user));
    return sendSuccess(res, { ok: true });
  } catch (err) {
    next(err);
  }
}

// ── Helper ───────────────────────────────────────────────────────────────────
function toPublic(obj) {
  const r = { ...obj };
  r.id = (obj._id || obj.id).toString();
  delete r._id;
  delete r.__v;
  if (r.userId) r.userId = r.userId.toString();
  r.createdAt = obj.createdAt instanceof Date ? obj.createdAt.toISOString() : obj.createdAt;
  return r;
}

module.exports = {
  listNotifications,
  createNotification,
  markRead,
  markAllRead,
  deleteNotification,
  clearAll,
};
