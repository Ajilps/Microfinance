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
  downloadAllTimeCSV,
  recordFinePayment,
  getUserFineReport,
  getAllTimeAttendanceSummary,
} from "../controllers/attendanceController.js";
import {
  addLoanTransaction,
  applyUnrecordedInterest,
  recordInterestEntry,
  calculateInterestToDate,
  previewLoanClosure,
  closeLoan,
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
import {
  deleteSavingsWithdrawal,
  recordSavingsWithdrawal,
  updateSavingsWithdrawal,
} from "../controllers/savingsWithdrawalController.js";
import {
  createExtraTransaction,
  getExtraTransactions,
  getWeeklyTransactions,
  updateExtraTransaction,
} from "../controllers/financeController.js";
import {
  createBankTransaction,
  getBankTransactions,
  updateBankTransaction,
} from "../controllers/bankTransactionController.js";
import {
  downloadLoanReport,
  downloadSavingsReport,
  getLoanReport,
  getSavingsReport,
} from "../controllers/reportController.js";
import {
  createProfitDistribution,
  getProfitDistributions,
  getProfitOverview,
  lockProfitDistributionUnallocation,
  unallocateProfitDistribution,
} from "../controllers/profitController.js";
import { adminProtect } from "../middleware/adminMiddleware.js";
import asyncHandler from "../middleware/asyncHandler.js";
import { getDashboardOverview } from "../controllers/dashboardController.js";
import {
  getMemberDirectory,
  getMemberWorkspace,
} from "../controllers/memberWorkspaceController.js";
import { getInterestAutomationStatus } from "../utils/interestCron.js";
import {
  changeAdminPassword,
  getAdminProfile,
  updateAdminProfile,
} from "../controllers/adminProfileController.js";

const router = express.Router();

// ─── Current Admin Profile ──────────────────────────────────────────────────
router.get("/profile", adminProtect, asyncHandler(getAdminProfile));
router.put("/profile", adminProtect, asyncHandler(updateAdminProfile));
router.put(
  "/profile/password",
  adminProtect,
  asyncHandler(changeAdminPassword),
);

// ─── Dashboard Analytics ─────────────────────────────────────────────────────
router.get(
  "/dashboard/overview",
  adminProtect,
  asyncHandler(getDashboardOverview),
);

// ─── Member Workspace ───────────────────────────────────────────────────────
router.get("/members", adminProtect, asyncHandler(getMemberDirectory));
router.get(
  "/members/:userId/workspace",
  adminProtect,
  asyncHandler(getMemberWorkspace),
);
router.get("/interest-automation/status", adminProtect, (req, res) => {
  res.json(getInterestAutomationStatus());
});

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
// GET /api/admin/attendance?date=2026-03-16
router.get("/attendance", adminProtect, getAttendanceByDate);
// GET /api/admin/attendance/monthly?month=3&year=2026
router.get("/attendance/monthly", adminProtect, getMonthlyAttendanceSummary);
router.get("/attendance/all", adminProtect, getAllTimeAttendanceSummary);
// GET /api/admin/attendance/download?month=3&year=2026
router.get("/attendance/download", adminProtect, downloadMonthlyCSV);
router.get(
  "/attendance/download/all",
  adminProtect,
  asyncHandler(downloadAllTimeCSV),
);

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
router.get(
  "/loans/:userId/close/preview",
  adminProtect,
  asyncHandler(previewLoanClosure),
);
router.post(
  "/loans/:userId/close",
  adminProtect,
  asyncHandler(closeLoan),
);
// POST   /api/admin/loans/:userId/transaction — add loan/repayment/fine transaction
router.post("/loans/:userId/transaction", adminProtect, addLoanTransaction);
// POST   /api/admin/loans/:userId/interest — record a 4-week interest entry
router.post("/loans/:userId/interest", adminProtect, recordInterestEntry);
// POST   /api/admin/loans/:userId/interest/apply-unrecorded — apply unrecorded interest to balance
router.post(
  "/loans/:userId/interest/apply-unrecorded",
  adminProtect,
  applyUnrecordedInterest,
);
// DELETE /api/admin/loans/:userId/transaction/:transactionId — hard-delete a loan transaction
router.delete(
  "/loans/:userId/transaction/:transactionId",
  adminProtect,
  deleteLoanTransaction,
);

// ─── Savings Management ───────────────────────────────────────────────────────
// POST   /api/admin/savings/:userId/payment — record weekly savings payment
router.post("/savings/:userId/payment", adminProtect, recordSavingsPayment);
router.post(
  "/savings/:userId/withdrawal",
  adminProtect,
  asyncHandler(recordSavingsWithdrawal),
);
router.put(
  "/savings/:userId/withdrawal/:withdrawalId",
  adminProtect,
  asyncHandler(updateSavingsWithdrawal),
);
router.delete(
  "/savings/:userId/withdrawal/:withdrawalId",
  adminProtect,
  asyncHandler(deleteSavingsWithdrawal),
);
// PUT    /api/admin/savings/:userId/payment/:paymentId — update a savings entry
router.put(
  "/savings/:userId/payment/:paymentId",
  adminProtect,
  updateSavingsPayment,
);
// DELETE /api/admin/savings/:userId/payment/:paymentId — hard-delete a savings payment
router.delete(
  "/savings/:userId/payment/:paymentId",
  adminProtect,
  deleteSavingsPayment,
);
// GET    /api/admin/savings/:userId — full savings history + interest for a user
router.get("/savings/:userId", adminProtect, getUserSavingsDetail);
// GET    /api/admin/savings — all users' savings overview
router.get("/savings", adminProtect, getAllUsersSavingsOverview);

// ─── Finance & Weekly Cash Flow ───────────────────────────────────────────────
router.get("/finance/entries", adminProtect, asyncHandler(getExtraTransactions));
router.post(
  "/finance/entries",
  adminProtect,
  asyncHandler(createExtraTransaction),
);
router.put(
  "/finance/entries/:id",
  adminProtect,
  asyncHandler(updateExtraTransaction),
);
router.get("/finance/weekly", adminProtect, asyncHandler(getWeeklyTransactions));
router.get(
  "/finance/bank-transactions",
  adminProtect,
  asyncHandler(getBankTransactions),
);
router.post(
  "/finance/bank-transactions",
  adminProtect,
  asyncHandler(createBankTransaction),
);
router.put(
  "/finance/bank-transactions/:id",
  adminProtect,
  asyncHandler(updateBankTransaction),
);
router.get("/finance/profit", adminProtect, asyncHandler(getProfitOverview));
router.get(
  "/finance/profit/distributions",
  adminProtect,
  asyncHandler(getProfitDistributions),
);
router.post(
  "/finance/profit/distributions",
  adminProtect,
  asyncHandler(createProfitDistribution),
);
router.patch(
  "/finance/profit/distributions/:id/unallocate",
  adminProtect,
  asyncHandler(unallocateProfitDistribution),
);
router.patch(
  "/finance/profit/distributions/:id/lock-unallocate",
  adminProtect,
  asyncHandler(lockProfitDistributionUnallocation),
);

// ─── Downloadable Reports ────────────────────────────────────────────────────
router.get("/reports/loans", adminProtect, asyncHandler(getLoanReport));
router.get(
  "/reports/loans/download",
  adminProtect,
  asyncHandler(downloadLoanReport),
);
router.get("/reports/savings", adminProtect, asyncHandler(getSavingsReport));
router.get(
  "/reports/savings/download",
  adminProtect,
  asyncHandler(downloadSavingsReport),
);

export default router;
