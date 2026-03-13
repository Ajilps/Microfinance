import { Response } from "express";
import { validationResult } from "express-validator";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import config from "../../config/env.config";
import { AuthenticatedRequest, IUser, JwtPayload, UserRole } from "../../types";
import ApiResponse from "../../utils/ApiResponse";
import AppError from "../../utils/AppError";
import asyncHandler from "../../utils/AsyncHandler";
import * as authService from "./service";

// ─── Helper ───────────────────────────────────────────────────────────────────

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Sign a JWT for a Mongoose IUser document.
 */
const signJwt = (user: IUser): string => {
  const payload: JwtPayload = {
    id: (user._id as Types.ObjectId).toString(),
    email: user.email,
    role: user.role,
    organizationId: user.organizationId ? user.organizationId.toString() : "",
  };
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

// ─── Local Auth Controllers ───────────────────────────────────────────────────

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

    const { email, password, fullName, phone, organizationName, role } = req.body;

    const result = await authService.register({
      email,
      password,
      fullName,
      phone,
      organizationName,
      role,
    });

    res.cookie("token", result.token, COOKIE_OPTIONS);

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

    const { email, password, organizationName } = req.body;

    const result = await authService.login({ email, password, organizationName });

    res.cookie("token", result.token, COOKIE_OPTIONS);

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

// ─── Admin Login Controller ───────────────────────────────────────────────────

/**
 * POST /api/v1/admin/auth/login
 * Authenticate an admin or super_admin user by email only (no organizationId required).
 */
export const adminLogin = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    const { email, password } = req.body;

    const result = await authService.adminLogin(email, password);

    res.cookie("token", result.token, COOKIE_OPTIONS);

    return ApiResponse.success(res, "Admin login successful", {
      user: result.user,
      token: result.token,
    });
  },
);

// ─── Google OAuth Controllers ─────────────────────────────────────────────────

/**
 * GET /api/v1/auth/google/callback
 *
 * Called by Passport after Google verifies the user.
 * `req.user` here is the Mongoose IUser document returned from the strategy.
 * We sign a JWT and redirect the user back to the frontend with the token.
 */
export const googleCallback = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    // req.user is set by passport.authenticate in the router
    const oauthUser = req.user as unknown as IUser;

    if (!oauthUser) {
      throw new AppError("Google authentication failed.", 401);
    }

    const token = signJwt(oauthUser);

    // Set as HttpOnly cookie (same as email/password flow)
    res.cookie("token", token, COOKIE_OPTIONS);

    // Redirect to frontend — the frontend can read the cookie or we append
    // the token as a query param for SPAs that prefer that approach.
    const redirectUrl = `${config.frontendUrl}/auth/callback?token=${token}`;
    return res.redirect(redirectUrl);
  },
);
