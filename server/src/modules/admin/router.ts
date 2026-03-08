import { Router } from "express";
import {
  protect,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware";
import * as authController from "../auth/controller";
import { loginValidation, registerValidation } from "../auth/validation";

const router = Router();

/**
 * Admin Auth Routes — mounted at /api/v1/admin/auth
 *
 * These routes reuse the existing auth controller and service.
 * The login endpoint is identical to /api/v1/auth/login but is provided
 * here as a dedicated admin entry point for clarity.
 *
 * Role enforcement on the returned JWT is handled by the client and by
 * the `isAdmin` / `isSuperAdmin` middleware on protected admin routes.
 */

// POST /api/v1/admin/auth/login
// Authenticate an admin or super_admin user and return a JWT.
router.post("/login", loginValidation, authController.login);

// POST /api/v1/admin/auth/register
// Register a new admin user (super_admin only).
router.post(
  "/register",
  protect,
  isSuperAdmin,
  registerValidation,
  authController.register,
);

// GET /api/v1/admin/auth/me
// Get the current admin user's profile.
router.get("/me", protect, isAdmin, authController.getMe);

// POST /api/v1/admin/auth/logout
router.post("/logout", protect, isAdmin, authController.logout);

export default router;
