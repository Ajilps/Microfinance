import "dotenv/config"; // Load env variables before anything else
import http from "http";
import app from "./app";
import connectDatabase from "./config/database.config";
import config from "./config/env.config";

const PORT = config.port;

/**
 * Graceful shutdown handler.
 */
const gracefulShutdown = (server: http.Server, signal: string): void => {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log("✅ HTTP server closed.");
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error("❌ Forced shutdown after timeout.");
    process.exit(1);
  }, 10_000).unref();
};

/**
 * Bootstrap the application.
 */
const bootstrap = async (): Promise<void> => {
  // Connect to MongoDB
  await connectDatabase();

  // Start HTTP server
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`
🚀 MicroFinance API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment : ${config.nodeEnv}
  Port        : ${PORT}
  API Base    : http://localhost:${PORT}/api
  Health      : http://localhost:${PORT}/api/health
  API v1      : http://localhost:${PORT}/api/v1
━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason: any) => {
    console.error("❌ Unhandled Rejection:", reason);
    gracefulShutdown(server, "UNHANDLED_REJECTION");
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (err: Error) => {
    console.error("❌ Uncaught Exception:", err);
    gracefulShutdown(server, "UNCAUGHT_EXCEPTION");
  });

  // Graceful shutdown on OS signals
  process.on("SIGTERM", () => gracefulShutdown(server, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(server, "SIGINT"));
};

bootstrap();
