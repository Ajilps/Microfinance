import { Router } from "express";
import passport from "passport";
import { protect } from "../../middleware/auth.middleware";
import * as authController from "./controller";
import { loginValidation, registerValidation } from "./validation";

const router = Router();

/**
 * Auth Routes — mounted at /api/v1/auth
 */

// ─── Local (email/password) ───────────────────────────────────────────────────

// POST /api/v1/auth/register
router.post("/register", registerValidation, authController.register);

// POST /api/v1/auth/login
router.post("/login", loginValidation, authController.login);

// POST /api/v1/auth/logout
router.post("/logout", protect, authController.logout);

// GET /api/v1/auth/me
router.get("/me", protect, authController.getMe);

// ─── Google OAuth 2.0 ────────────────────────────────────────────────────────

/**
 * GET /api/v1/auth/google
 * Initiates the Google OAuth 2.0 flow.
 * Redirects the user to Google's consent page.
 */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false, // Stateless — we use JWT, not sessions
  }),
);

/**
 * GET /api/v1/auth/google/callback
 * Google redirects here after the user grants access.
 * Passport exchanges the code, calls the verify callback, sets req.user,
 * then we sign a JWT and redirect to the frontend.
 */
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/api/v1/auth/google/failure",
  }),
  authController.googleCallback,
);

/**
 * GET /api/v1/auth/google/failure
 * Called when Google OAuth authentication fails.
 */
router.get("/google/failure", (req, res) => {
  res.status(401).json({
    success: false,
    message: "Google authentication failed. Please try again.",
  });
});

export default router;
