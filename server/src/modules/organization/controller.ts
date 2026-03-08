import { Response } from "express";
import { validationResult } from "express-validator";
import { AuthenticatedRequest, UserRole } from "../../types";
import ApiResponse from "../../utils/ApiResponse";
import AppError from "../../utils/AppError";
import asyncHandler from "../../utils/AsyncHandler";
import * as orgService from "./service";

/**
 * POST /api/v1/organizations
 * Create a new organization. The authenticated user becomes the owner.
 */
export const createOrganization = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    const { name, subdomain, subscriptionPlan, settings } = req.body;

    const org = await orgService.createOrganization({
      name,
      subdomain,
      subscriptionPlan,
      settings,
      ownerId: req.user.id,
    });

    return ApiResponse.created(res, "Organization created successfully", {
      organization: org,
    });
  },
);

/**
 * GET /api/v1/organizations
 * List all organizations (super_admin only).
 */
export const getAllOrganizations = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) throw new AppError("Not authenticated", 401);

    const organizations = await orgService.getAllOrganizations();

    return ApiResponse.success(res, "Organizations fetched successfully", {
      organizations,
    });
  },
);

/**
 * GET /api/v1/organizations/:id
 * Get a single organization by ID.
 */
export const getOrganizationById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    // Non-super-admins can only view their own organization
    const orgId =
      req.user.role === UserRole.SUPER_ADMIN
        ? req.params.id
        : req.user.organizationId;

    const org = await orgService.getOrganizationById(orgId);

    return ApiResponse.success(res, "Organization fetched successfully", {
      organization: org,
    });
  },
);

/**
 * PATCH /api/v1/organizations/:id
 * Update an organization (owner or super_admin).
 */
export const updateOrganization = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    const { name, subscriptionPlan, settings } = req.body;

    const org = await orgService.updateOrganization(req.params.id, {
      name,
      subscriptionPlan,
      settings,
    });

    return ApiResponse.success(res, "Organization updated successfully", {
      organization: org,
    });
  },
);

/**
 * DELETE /api/v1/organizations/:id
 * Deactivate an organization (super_admin only).
 */
export const deactivateOrganization = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ApiResponse.badRequest(res, "Validation failed", errors.array());
    }

    if (!req.user) throw new AppError("Not authenticated", 401);

    await orgService.deactivateOrganization(req.params.id);

    return ApiResponse.success(res, "Organization deactivated successfully");
  },
);
