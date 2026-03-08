import { Router } from "express";
import {
  protect,
  isAdmin,
  isSuperAdmin,
} from "../../middleware/auth.middleware";
import * as orgController from "./controller";
import {
  createOrganizationValidation,
  orgIdParamValidation,
  updateOrganizationValidation,
} from "./validation";

const router = Router();

/**
 * Organization Routes — mounted at /api/v1/organizations
 */

// All routes require authentication
router.use(protect);

// POST /api/v1/organizations — any authenticated user can create an org
router.post(
  "/",
  createOrganizationValidation,
  orgController.createOrganization,
);

/**
 * GET /api/v1/organizations
 *
 * @description
 *   Returns a list of all active organizations in the system.
 *   This endpoint is restricted to users with the `SUPER_ADMIN` role only.
 *   The `protect` middleware runs first to verify the JWT and attach `req.user`;
 *   `isSuperAdmin` then enforces that only `super_admin` users may access the
 *   full organization list.
 *
 * @middleware
 *   1. `protect`      — Verifies the Bearer JWT token; attaches `req.user`.
 *                       Returns `401` if token is missing, invalid, or expired.
 *   2. `isSuperAdmin` — Allows access only to users with role `super_admin`.
 *                       Returns `403` for any other role (including `admin`).
 *
 * @queryparams
 *   None — returns all active organizations sorted by `-createdAt` (newest first).
 *
 * @response 200 OK
 *   {
 *     "success": true,
 *     "message": "Organizations fetched successfully",
 *     "data": {
 *       "organizations": [
 *         {
 *           "_id": "65f1a2b3c4d5e6f7a8b9c0d1",
 *           "name": "Demo Finance",
 *           "subdomain": "demo-finance",
 *           "subscriptionPlan": "premium",
 *           "isActive": true,
 *           "ownerId": "65f1a2b3c4d5e6f7a8b9c0d2",
 *           "settings": {
 *             "loanInterestRate": 5.5,
 *             "minSavingsForLoan": 1000
 *           },
 *           "createdAt": "2026-03-08T07:00:00.000Z",
 *           "updatedAt": "2026-03-08T07:00:00.000Z"
 *         }
 *       ]
 *     }
 *   }
 *
 * @response 401 Unauthorized
 *   Token is missing, invalid, or expired.
 *   {
 *     "success": false,
 *     "message": "Access denied. No token provided.",
 *     "error": null
 *   }
 *
 * @response 403 Forbidden
 *   Authenticated user does not have the `super_admin` role.
 *   {
 *     "success": false,
 *     "message": "Access denied. Super Admin role required.",
 *     "error": null
 *   }
 *
 * @response 500 Internal Server Error
 *   Unexpected server or database error.
 *   {
 *     "success": false,
 *     "message": "Internal Server Error",
 *     "error": { ... }
 *   }
 */
router.get("/", isSuperAdmin, orgController.getAllOrganizations);

// GET /api/v1/organizations/:id — admin or super_admin
router.get(
  "/:id",
  isAdmin,
  orgIdParamValidation,
  orgController.getOrganizationById,
);

// PATCH /api/v1/organizations/:id — admin or super_admin
router.patch(
  "/:id",
  isAdmin,
  [...orgIdParamValidation, ...updateOrganizationValidation],
  orgController.updateOrganization,
);

// DELETE /api/v1/organizations/:id — super_admin only
router.delete(
  "/:id",
  isSuperAdmin,
  orgIdParamValidation,
  orgController.deactivateOrganization,
);

export default router;
