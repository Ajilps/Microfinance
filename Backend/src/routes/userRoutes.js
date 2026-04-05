import express from "express";
import {
  registerUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";
import { getMyLoanSummary } from "../controllers/loanController.js";
import { getMySavingsSummary } from "../controllers/savingsController.js";
import { getMyAttendanceSummary } from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected routes
router.get("/", protect, getUsers);
router.get("/:id", protect, getUserById);
router.put("/:id", protect, updateUser);
router.delete("/:id", protect, deleteUser);

// ─── Loan (read-only for user) ────────────────────────────────────────────────
// GET /api/users/loans/me — own loan summary (total taken, paid, balance)
router.get("/loans/me", protect, getMyLoanSummary);

// ─── Savings (read-only for user) ────────────────────────────────────────────
// GET /api/users/savings/me — own savings total + weekly history
router.get("/savings/me", protect, getMySavingsSummary);
// ─── Attendance (read-only for user) ─────────────────────────────────────────
// GET /api/users/attendance/me?month=3&year=2026 — own attendance + fine summary
router.get("/attendance/me", protect, getMyAttendanceSummary);

export default router;
