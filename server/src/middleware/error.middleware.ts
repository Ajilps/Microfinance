import { Request, Response, NextFunction } from "express";
import config from "../config/env.config";
import AppError from "../utils/AppError";

/**
 * Global error handling middleware.
 * Must be registered LAST in the Express middleware chain.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  let statusCode: number = err.statusCode || 500;
  let message: string = err.message || "Internal Server Error";

  // Mongoose CastError (invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(", ");
    statusCode = 409;
    message = `Duplicate value for field: ${field}`;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors || {}).map((e: any) => e.message);
    statusCode = 400;
    message = `Validation failed: ${errors.join(". ")}`;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please log in again.";
  }

  const response: Record<string, any> = {
    success: false,
    message,
  };

  // Include stack trace only in development
  if (config.nodeEnv === "development") {
    response.error = err;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
