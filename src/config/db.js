"use strict";

const mongoose = require("mongoose");

/**
 * Connect to MongoDB.
 * Exits the process if the initial connection fails — no point
 * starting the server without a database.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("[DB] MONGODB_URI is not set in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log(`[DB] Connected → ${mongoose.connection.host}`);
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] Disconnected from MongoDB.");
  });

  mongoose.connection.on("error", (err) => {
    console.error("[DB] Runtime error:", err.message);
  });
}

module.exports = connectDB;
