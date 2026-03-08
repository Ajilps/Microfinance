import { Request, Response, NextFunction } from "express";
import AppError from "../utils/AppError";

/**
 * Catches all unhandled routes and passes a 404 AppError to the error middleware.
 */
const notFound = (req: Request, res: Response, next: NextFunction): void => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

export default notFound;
