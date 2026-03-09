import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import config from "../../config/env.config";
import { IUser, JwtPayload, UserRole } from "../../types";
import AppError from "../../utils/AppError";
import User from "./model";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationId: string;
  role?: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
  organizationId: string;
}

interface AuthResult {
  user: Omit<IUser, "password">;
  token: string;
}

/**
 * Generates a signed JWT token for the given user.
 */
const signToken = (user: IUser): string => {
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

/**
 * Registers a new user within an organization.
 */
export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const existing = await User.findOne({
    email: input.email,
    organizationId: input.organizationId,
  });

  if (existing) {
    throw new AppError(
      "An account with this email already exists in this organization.",
      409,
    );
  }

  const user = await User.create(input);
  const token = signToken(user);

  // Return user without password
  const userObj = user.toObject() as any;
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Authenticates a user and returns a JWT token.
 */
export const login = async (input: LoginInput): Promise<AuthResult> => {
  // Select password explicitly (it's excluded by default)
  const user = await User.findOne({
    email: input.email,
    organizationId: input.organizationId,
    isActive: true,
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = signToken(user);

  const userObj = user.toObject() as any;
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Authenticates an admin/super_admin user by email only (no organizationId required).
 * Used by the /api/v1/admin/auth/login endpoint.
 */
export const adminLogin = async (
  email: string,
  password: string,
): Promise<AuthResult> => {
  const user = await User.findOne({
    email,
    isActive: true,
    role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  }).select("+password");

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError("Invalid email or password.", 401);
  }

  const token = signToken(user);

  const userObj = user.toObject() as any;
  delete userObj.password;

  return { user: userObj, token };
};

/**
 * Returns the currently authenticated user's profile.
 */
export const getProfile = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};
