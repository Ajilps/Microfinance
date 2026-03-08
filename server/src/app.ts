import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";

// Initialize Passport + Google strategy (must be imported before route setup)
import "./config/passport.config";
import passport from "passport";

import config from "./config/env.config";
import apiRoutes from "./routes";
import errorHandler from "./middleware/error.middleware";
import notFound from "./middleware/notFound.middleware";

const app: Application = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet()); // Set security HTTP headers

app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true, // Allow cookies / auth headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting — 100 req / 15 min per IP (applied to all /api routes)
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
app.use("/api", limiter);

// ─── Parsing Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: "10kb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// ─── Sanitization ─────────────────────────────────────────────────────────────
app.use(mongoSanitize()); // Prevent NoSQL injection via query/body

// ─── Logging ──────────────────────────────────────────────────────────────────
if (config.nodeEnv === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// ─── Passport Initialization ──────────────────────────────────────────────────
// We use stateless JWT — no session is needed.
// passport.initialize() is required for passport.authenticate() to work.
app.use(passport.initialize());

// ─── API Routes ───────────────────────────────────────────────────────────────
// Health endpoint at /api/health (no versioning prefix needed)
// All other routes at /api/v1/...
app.use("/api", apiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Must be the LAST middleware registered
app.use(errorHandler);

export default app;
