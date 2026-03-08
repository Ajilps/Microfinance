import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as authController from "./controller";
import { loginValidation, registerValidation } from "./validation";

const router = Router();

/**
 * Auth Routes — mounted at /api/v1/auth
 */

// POST /api/v1/auth/register
router.post("/register", registerValidation, authController.register);

// POST /api/v1/auth/login
router.post("/login", loginValidation, authController.login);

// POST /api/v1/auth/logout
router.post("/logout", protect, authController.logout);

// GET /api/v1/auth/me
router.get("/me", protect, authController.getMe);

export default router;
