import express from "express";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  createUser,
  createAdmin,
  getAllAdmins,
} from "../controllers/adminController.js";
import {
  markBulkAttendance,
  getAttendanceByDate,
  getMonthlyAttendanceSummary,
  downloadMonthlyCSV,
  recordFinePayment,
  getUserFineReport,
} from "../controllers/attendanceController.js";
import {
  addLoanTransaction,
  applyUnrecordedInterest,
  recordInterestEntry,
  calculateInterestToDate,
  getUserLoanDetail,
  getAllUsersLoanOverview,
  deleteLoanTransaction,
} from "../controllers/loanController.js";
import {
  recordSavingsPayment,
  updateSavingsPayment,
  getUserSavingsDetail,
  getAllUsersSavingsOverview,
  deleteSavingsPayment,
} from "../controllers/savingsController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";

const router = express.Router();

// ─── User Management ──────────────────────────────────────────────────────────
router.get("/users", adminProtect, getAllUsers);
router.post("/users", adminProtect, createUser);
router.get("/users/:id", adminProtect, getUserById);
router.put("/users/:id", adminProtect, updateUser);
router.delete("/users/:id", adminProtect, deleteUser);
router.post("/create", adminProtect, createAdmin);
router.get("/all", adminProtect, getAllAdmins);

// ─── Attendance ───────────────────────────────────────────────────────────────
// Mark weekly attendance for all users (bulk upsert)
router.post("/attendance", adminProtect, markBulkAttendance);
// GET /api/admin/attendance?date=2026-03-16&weekStartDay=0
router.get("/attendance", adminProtect, getAttendanceByDate);
// GET /api/admin/attendance/monthly?month=3&year=2026
router.get("/attendance/monthly", adminProtect, getMonthlyAttendanceSummary);
// GET /api/admin/attendance/download?month=3&year=2026
router.get("/attendance/download", adminProtect, downloadMonthlyCSV);

// ─── Fine Payments ────────────────────────────────────────────────────────────
// POST /api/admin/attendance/fine/payment — record a fine payment
router.post("/attendance/fine/payment", adminProtect, recordFinePayment);
// GET /api/admin/attendance/fine/:userId?month=3&year=2026
router.get("/attendance/fine/:userId", adminProtect, getUserFineReport);

// ─── Loan Management ──────────────────────────────────────────────────────────
// GET    /api/admin/loans — all users' loan balances overview
router.get("/loans", adminProtect, getAllUsersLoanOverview);
// GET    /api/admin/loans/:userId — full loan ledger + summary for a user
router.get("/loans/:userId", adminProtect, getUserLoanDetail);
// GET    /api/admin/loans/:userId/interest/calculate?toDate=YYYY-MM-DD — preview interest periods
router.get(
  "/loans/:userId/interest/calculate",
  adminProtect,
  calculateInterestToDate,
);
// POST   /api/admin/loans/:userId/transaction — add loan/repayment/fine transaction
router.post("/loans/:userId/transaction", adminProtect, addLoanTransaction);
// POST   /api/admin/loans/:userId/interest — record a 4-week interest entry
router.post("/loans/:userId/interest", adminProtect, recordInterestEntry);
// POST   /api/admin/loans/:userId/interest/apply-unrecorded — apply unrecorded interest to balance
router.post("/loans/:userId/interest/apply-unrecorded", adminProtect, applyUnrecordedInterest);
// DELETE /api/admin/loans/:userId/transaction/:transactionId — hard-delete a loan transaction
router.delete("/loans/:userId/transaction/:transactionId", adminProtect, deleteLoanTransaction);

// ─── Savings Management ───────────────────────────────────────────────────────
// POST   /api/admin/savings/:userId/payment — record weekly savings payment
router.post("/savings/:userId/payment", adminProtect, recordSavingsPayment);
// PUT    /api/admin/savings/:userId/payment/:paymentId — update a savings entry
router.put(
  "/savings/:userId/payment/:paymentId",
  adminProtect,
  updateSavingsPayment,
);
// DELETE /api/admin/savings/:userId/payment/:paymentId — hard-delete a savings payment
router.delete("/savings/:userId/payment/:paymentId", adminProtect, deleteSavingsPayment);
// GET    /api/admin/savings/:userId — full savings history + interest for a user
router.get("/savings/:userId", adminProtect, getUserSavingsDetail);
// GET    /api/admin/savings — all users' savings overview
router.get("/savings", adminProtect, getAllUsersSavingsOverview);

export default router;
