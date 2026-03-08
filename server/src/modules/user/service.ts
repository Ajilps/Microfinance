import { IUser, PaginatedResult, PaginationQuery } from "../../types";
import AppError from "../../utils/AppError";
import User from "./model";

/**
 * Retrieves a paginated list of users for a given organization.
 */
export const getUsers = async (
  organizationId: string,
  query: PaginationQuery,
): Promise<PaginatedResult<IUser>> => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const skip = (page - 1) * limit;
  const sort = query.sort || "-createdAt";

  const [data, total] = await Promise.all([
    User.find({ organizationId, isActive: true })
      .select("-password")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments({ organizationId, isActive: true }),
  ]);

  return {
    data: data as unknown as IUser[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * Retrieves a single user by ID, scoped to the organization.
 */
export const getUserById = async (
  userId: string,
  organizationId: string,
): Promise<IUser> => {
  const user = await User.findOne({ _id: userId, organizationId }).select(
    "-password",
  );

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
};

/**
 * Updates a user's profile fields.
 * Restricts which fields can be changed (no password or role via this method).
 */
export const updateUser = async (
  userId: string,
  organizationId: string,
  updates: Partial<Pick<IUser, "fullName" | "phone">>,
): Promise<IUser> => {
  const user = await User.findOneAndUpdate(
    { _id: userId, organizationId },
    { $set: updates },
    { new: true, runValidators: true },
  ).select("-password");

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
};

/**
 * Soft-deletes a user by setting isActive to false.
 */
export const deactivateUser = async (
  userId: string,
  organizationId: string,
): Promise<void> => {
  const user = await User.findOneAndUpdate(
    { _id: userId, organizationId },
    { $set: { isActive: false } },
  );

  if (!user) {
    throw new AppError("User not found.", 404);
  }
};
