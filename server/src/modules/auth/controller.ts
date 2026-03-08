import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest } from "../../types";
import ApiResponse from "../../utils/ApiResponse";
import AppError from "../../utils/AppError";
import asyncHandler from "../../utils/AsyncHandler";
import * as authService from "./service";

/**
 * POST /api/v1/auth/register
 * Register a new user
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    const { email, password, fullName, phone, organizationId, role } = req.body;

    const result = await authService.register({
      email,
      password,
      fullName,
      phone,
      organizationId,
      role,
    });

    // Set JWT as HttpOnly cookie
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return ApiResponse.created(res, "Registration successful", {
      user: result.user,
      token: result.token,
    });
  },
);

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT token
 */
export const login = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    const { email, password, organizationId } = req.body;

    const result = await authService.login({ email, password, organizationId });

    // Set JWT as HttpOnly cookie
    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return ApiResponse.success(res, "Login successful", {
      user: result.user,
      token: result.token,
    });
  },
);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
export const getMe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      throw new AppError("Not authenticated", 401);
    }

    const user = await authService.getProfile(req.user.id);

    return ApiResponse.success(res, "Profile fetched successfully", { user });
  },
);

/**
 * POST /api/v1/auth/logout
 * Clear the auth cookie
 */
export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    res.clearCookie("token");
    return ApiResponse.success(res, "Logged out successfully");
  },
);
