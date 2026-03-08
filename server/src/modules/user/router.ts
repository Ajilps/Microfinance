import { Router } from "express";
import { protect, restrictTo } from "../../middleware/auth.middleware";
import { UserRole } from "../../types";
import * as userController from "./controller";
import { updateProfileValidation, userIdParamValidation } from "./validation";

const router = Router();

/**
 * User Routes — mounted at /api/v1/users
 */

// All routes below require authentication
router.use(protect);

// GET /api/v1/users — Admin/Manager only
router.get(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER),
  userController.getUsers,
);

// GET /api/v1/users/:id
router.get("/:id", userIdParamValidation, userController.getUserById);

// PATCH /api/v1/users/:id
router.patch(
  "/:id",
  [...userIdParamValidation, ...updateProfileValidation],
  userController.updateUser,
);

// DELETE /api/v1/users/:id — Admin only
router.delete(
  "/:id",
  restrictTo(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  userIdParamValidation,
  userController.deactivateUser,
);

export default router;
