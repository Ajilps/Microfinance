import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest, UserRole } from "../../types";
import ApiResponse from "../../utils/ApiResponse";
import AppError from "../../utils/AppError";
import asyncHandler from "../../utils/AsyncHandler";
import * as userService from "./service";

/**
 * GET /api/v1/users
 * List all users in the current organization (admin/manager only)
 */
export const getUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new AppError("Not authenticated", 401);

    const { page, limit, sort } = req.query as any;

    const result = await userService.getUsers(req.user.organizationId, {
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
      sort,
    });

    return ApiResponse.success(res, "Users fetched successfully", result);
  },
);

/**
 * GET /api/v1/users/:id
 * Get a single user by ID
 */
export const getUserById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    const user = await userService.getUserById(
      req.params.id,
      req.user.organizationId,
    );

    return ApiResponse.success(res, "User fetched successfully", { user });
  },
);

/**
 * PATCH /api/v1/users/:id
 * Update a user profile (self or admin)
 */
export const updateUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    // Non-admins can only update their own profile
    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.SUPER_ADMIN &&
      req.user.id !== req.params.id
    ) {
      throw new AppError("You can only update your own profile.", 403);
    }

    const { fullName, phone } = req.body;

    const user = await userService.updateUser(
      req.params.id,
      req.user.organizationId,
      { fullName, phone },
    );

    return ApiResponse.success(res, "User updated successfully", { user });
  },
);

/**
 * DELETE /api/v1/users/:id
 * Deactivate a user (admin only)
 */
export const deactivateUser = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    await userService.deactivateUser(req.params.id, req.user.organizationId);

    return ApiResponse.success(res, "User deactivated successfully");
  },
);
