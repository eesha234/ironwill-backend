"use strict";

require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth.routes");
const approvalsRoutes = require("./routes/approvals.routes");
const adminRoutes = require("./routes/admin.routes");
const membersRoutes = require("./routes/members.routes");
const trainersRoutes = require("./routes/trainers.routes");
const plansRoutes = require("./routes/plans.routes");
const paymentsRoutes = require("./routes/payments.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const notificationsRoutes = require("./routes/notifications.routes");
const admsRoutes = require("./routes/adms.routes");
const { errorHandler, notFound } = require("./middleware/error.middleware");

const app = express();

// Render/most PaaS run behind a reverse proxy — trust the first hop so
// req.ip, secure cookies, and express-rate-limit behave correctly.
app.set("trust proxy", 1);

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      const err = new Error(`CORS: origin '${origin}' not allowed`);
      err.statusCode = 403;
      err.code = "CORS_REJECTED";
      callback(err);
    },
    credentials: true, // needed for httpOnly cookies
  })
);

// ─── Biometric device endpoint (eSSL/ZKTeco ADMS push protocol) ──────────────
// Mounted before global body parsing/rate-limiting: the device speaks plain
// text, polls frequently, and can't do JWT auth, so it's handled separately.
app.use("/iclock", admsRoutes);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── NoSQL injection protection ───────────────────────────────────────────────
app.use(mongoSanitize());

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Global rate limiting ─────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many requests, please try again later.", code: "RATE_LIMITED" } },
});

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: "Too many auth attempts, please try again in 15 minutes.", code: "AUTH_RATE_LIMITED" } },
});

app.use(globalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { status: "ok", timestamp: new Date().toISOString() } });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/approvals", approvalsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/members", membersRoutes);
app.use("/api/trainers", trainersRoutes);
app.use("/api/plans", plansRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/notifications", notificationsRoutes);

// ─── 404 & Error handling ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
