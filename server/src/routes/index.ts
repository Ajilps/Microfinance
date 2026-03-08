import { Router, Request, Response } from "express";
import authRouter from "../modules/auth/router";
import userRouter from "../modules/user/router";

const router = Router();

/**
 * API Health Check — GET /api/health
 */
router.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "MicroFinance API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Feature Routes — all prefixed with /api/v1
 */
router.use("/v1/auth", authRouter);
router.use("/v1/users", userRouter);

export default router;
