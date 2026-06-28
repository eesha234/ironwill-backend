"use strict";

require("dotenv").config();

const connectDB = require("./config/db");
const app = require("./app");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Server] SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      console.log("[Server] HTTP server closed.");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("[Server] SIGINT received. Shutting down gracefully...");
    server.close(() => {
      process.exit(0);
    });
  });
}

start();
