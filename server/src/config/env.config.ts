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

  // ─── Google OAuth 2.0 ─────────────────────────────────────────────────────
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleCallbackUrl:
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/api/v1/auth/google/callback",

  // ─── Frontend ─────────────────────────────────────────────────────────────
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  // ─── Seed / Default Admin Credentials ────────────────────────────────────
  superAdminEmail:
    process.env.SUPER_ADMIN_EMAIL || "superadmin@microfinance.com",
  superAdminPassword: process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123",
  superAdminFullName: process.env.SUPER_ADMIN_FULL_NAME || "Super Admin",

  adminEmail: process.env.ADMIN_EMAIL || "admin@microfinance.com",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@123",
  adminFullName: process.env.ADMIN_FULL_NAME || "Admin User",

  // ─── Rate Limiting ────────────────────────────────────────────────────────
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 min
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
} as const;

export default config;
