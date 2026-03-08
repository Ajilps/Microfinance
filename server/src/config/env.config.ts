import dotenv from "dotenv";
import path from "path";

// Load .env from the project root (two levels up from src/config/)
dotenv.config({ path: path.resolve(__dirname, "../../..", ".env") });

/**
 * Centralised, typed environment configuration.
 * All process.env accesses should go through this object.
 */
const config = {
  // ─── Server ───────────────────────────────────────────────────────────────
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  apiPrefix: process.env.API_PREFIX || "/api/v1",

  // ─── Database ─────────────────────────────────────────────────────────────
  mongodbUri:
    process.env.MONGODB_URI || "mongodb://localhost:27017/microfinance",

  // ─── JWT ──────────────────────────────────────────────────────────────────
  jwtSecret: process.env.JWT_SECRET || "changeme_super_secret_key",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // ─── CORS ─────────────────────────────────────────────────────────────────
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:5173").split(","),

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 min
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
} as const;

export default config;
