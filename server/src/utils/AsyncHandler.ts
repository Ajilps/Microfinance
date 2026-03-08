import { Request, Response, NextFunction } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<any>;

/**
 * Wraps an async route handler to catch errors and pass them to Express error middleware.
 * Eliminates the need for try/catch blocks in every controller function.
 *
 * @example
 * router.get('/', asyncHandler(async (req, res) => {
 *   const data = await someService.getData();
 *   res.json(data);
 * }));
 */
const asyncHandler =
  (fn: AsyncRequestHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export default asyncHandler;
