import { Types } from "mongoose";
import { IOrganization } from "../../types";
import AppError from "../../utils/AppError";
import Organization from "./model";

interface CreateOrganizationInput {
  name: string;
  subdomain: string;
  subscriptionPlan?: string;
  ownerId: string;
  settings?: {
    loanInterestRate?: number;
    minSavingsForLoan?: number;
  };
}

interface UpdateOrganizationInput {
  name?: string;
  subscriptionPlan?: string;
  settings?: {
    loanInterestRate?: number;
    minSavingsForLoan?: number;
  };
}

/**
 * Creates a new organization and assigns the requesting user as owner.
 */
export const createOrganization = async (
  input: CreateOrganizationInput,
): Promise<IOrganization> => {
  const existing = await Organization.findOne({ subdomain: input.subdomain });
  if (existing) {
    throw new AppError(
      `Subdomain "${input.subdomain}" is already taken. Please choose a different subdomain.`,
      409,
    );
  }

  const org = await Organization.create({
    name: input.name,
    subdomain: input.subdomain.toLowerCase(),
    subscriptionPlan: input.subscriptionPlan || "free",
    ownerId: new Types.ObjectId(input.ownerId),
    settings: {
      loanInterestRate: input.settings?.loanInterestRate ?? 5.0,
      minSavingsForLoan: input.settings?.minSavingsForLoan ?? 1000,
    },
  });

  return org;
};

/**
 * Returns all active organizations (super_admin only).
 */
export const getAllOrganizations = async (): Promise<IOrganization[]> => {
  return Organization.find({ isActive: true })
    .sort("-createdAt")
    .lean() as unknown as IOrganization[];
};

/**
 * Returns a single organization by ID.
 */
export const getOrganizationById = async (
  orgId: string,
): Promise<IOrganization> => {
  const org = await Organization.findById(orgId);
  if (!org) {
    throw new AppError("Organization not found.", 404);
  }
  return org;
};

/**
 * Updates an organization's mutable fields.
 */
export const updateOrganization = async (
  orgId: string,
  updates: UpdateOrganizationInput,
): Promise<IOrganization> => {
  const org = await Organization.findByIdAndUpdate(
    orgId,
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!org) {
    throw new AppError("Organization not found.", 404);
  }

  return org;
};

/**
 * Soft-deactivates an organization.
 */
export const deactivateOrganization = async (orgId: string): Promise<void> => {
  const org = await Organization.findByIdAndUpdate(orgId, {
    $set: { isActive: false },
  });

  if (!org) {
    throw new AppError("Organization not found.", 404);
  }
};
