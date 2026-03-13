import { Router } from "express";
import {
  protect,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware";
import * as authController from "../auth/controller";
import { adminLoginValidation, registerValidation } from "../auth/validation";

const router = Router();

/**
 * Admin Auth Routes — mounted at /api/v1/admin/auth
 *
 * Login does NOT require organizationId — super_admin and admin users
 * are platform-level and are looked up by email only.
 */

// POST /api/v1/admin/auth/login
// Authenticate an admin or super_admin user (no organizationId needed).
router.post("/login", adminLoginValidation, authController.adminLogin);

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
