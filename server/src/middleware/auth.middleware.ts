import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config/env.config";
import { AuthenticatedRequest, JwtPayload } from "../types";
import AppError from "../utils/AppError";

/**
 * Middleware to verify the JWT token from the Authorization header or cookie.
 * Attaches the decoded payload to `req.user`.
 */
export const protect = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void => {
  try {
    let token: string | undefined;

    // Check Authorization header first, then cookie
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return next(new AppError("Access denied. No token provided.", 401));
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;

    next();
  } catch (err: any) {
    if (err.name === "JsonWebTokenError") {
      return next(new AppError("Invalid token.", 401));
    }
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired. Please log in again.", 401));
    }
    next(err);
  }
};

/**
 * Middleware factory to restrict access to specific roles.
 * Must be used after `protect`.
 *
 * @example
 * router.delete('/users/:id', protect, restrictTo('admin', 'super_admin'), deleteUser);
 */
export const restrictTo =
  (...roles: string[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action.", 403),
      );
    }
    next();
  };
