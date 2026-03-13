import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import config from "../../config/env.config";
import { IUser, JwtPayload, UserRole } from "../../types";
import AppError from "../../utils/AppError";
import User from "./model";
import Organization from "../organization/model";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  organizationName: string;
  role?: UserRole;
}

interface LoginInput {
  email: string;
  password: string;
  organizationName: string;
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
    organizationId: user.organizationId.toString(),
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
};

/**
 * Registers a new user within an organization.
 */
export const register = async (input: RegisterInput): Promise<AuthResult> => {
  const cleanedName = input.organizationName.trim();
  const subdomain = cleanedName.toLowerCase().replace(/[^a-z0-9]/g, '');

  let organization = await Organization.findOne({ subdomain });
  
  if (!organization) {
    if (input.role !== UserRole.SUPER_ADMIN && input.role !== UserRole.ADMIN) {
        throw new AppError("No existing organization found. Only an admin can create a new organization.", 403);
    }
  
    // Create new organization
    organization = await Organization.create({
      name: cleanedName,
      subdomain
    });
  }

  const existing = await User.findOne({
    email: input.email,
    organizationId: organization._id,
  });

  if (existing) {
    throw new AppError(
      "An account with this email already exists in this organization.",
      409,
    );
  }

  const user = await User.create({
    email: input.email,
    password: input.password,
    fullName: input.fullName,
    phone: input.phone,
    role: input.role,
    organizationId: organization._id
  });
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
  const cleanedName = input.organizationName.trim();
  const subdomain = cleanedName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const organization = await Organization.findOne({ subdomain });
  if (!organization) {
     throw new AppError("Invalid organization or email.", 401);
  }

  const user = await User.findOne({
    email: input.email,
    organizationId: organization._id,
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
 * Returns the currently authenticated user's profile.
 */
export const getProfile = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("User not found.", 404);
  }
  return user;
};
