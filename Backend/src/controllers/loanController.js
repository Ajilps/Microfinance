import LoanTransaction from "../models/loanModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";
import {
  calculateInterestPeriods,
  computeLoanSummary,
} from "../services/loanLedgerService.js";
import { applyDueInterestForUser } from "../services/interestAutomationService.js";
import {
  buildLoanClosureDocument,
  buildLoanClosurePreview,
} from "../services/loanClosureService.js";

// ─── ADMIN: Add a loan transaction for a user ─────────────────────────────────
// POST /api/admin/loans/:userId/transaction
// Body: { type, amount, date, note, paymentTarget }
const addLoanTransaction = async (req, res) => {
  const { userId } = req.params;
  const { type, amount, date, note, paymentTarget } = req.body;

  if (!type || !amount || !date) {
    return res
      .status(400)
      .json({ message: "type, amount, and date are required" });
  }

  if (!["loan", "repayment", "fine"].includes(type)) {
    return res.status(400).json({
      message: "type must be 'loan', 'repayment', or 'fine'",
    });
  }

  const parsedAmount = Number(amount);
  const parsedDate = new Date(date);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "amount must be greater than 0" });
  }
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "date must be valid" });
  }

  // Validate paymentTarget for repayments
  if (type === "repayment" && !paymentTarget) {
    return res.status(400).json({
      message:
        "paymentTarget ('principal' or 'interest') is required for repayment transactions",
    });
  }

  if (
    type === "repayment" &&
    !["principal", "interest"].includes(paymentTarget)
  ) {
    return res.status(400).json({
      message: "paymentTarget must be 'principal' or 'interest'",
    });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  if (type === "repayment") {
    const currentTransactions = await LoanTransaction.find({ user: userId }).sort({
      date: 1,
    });
    const currentSummary = computeLoanSummary(currentTransactions);
    const availableBalance =
      paymentTarget === "principal"
        ? currentSummary.principalBalance
        : currentSummary.interestBalance;

    if (parsedAmount > availableBalance) {
      return res.status(400).json({
        message: `Repayment exceeds the ₹${availableBalance.toFixed(2)} ${paymentTarget} balance`,
      });
    }
  }

  const transactionData = {
    user: userId,
    type,
    amount: parsedAmount,
    date: parsedDate,
    note,
    recordedBy: req.user._id,
  };

  if (type === "repayment") {
    transactionData.paymentTarget = paymentTarget;
  }

  const transaction = await LoanTransaction.create(transactionData);

  res.status(201).json(transaction);
};

// ─── ADMIN: Record a single interest period (idempotent) ──────────────────────
// POST /api/admin/loans/:userId/interest
// Body: { periodStart, periodEnd, principalBalance, interestRate, interestAmount, date, note }
//
// Idempotency guarantee:
//   Before inserting, we check whether an interest transaction already exists
//   for this (user, periodStart). If so, we return the existing record with 200
//   instead of creating a duplicate. The unique DB index is the backstop: even
//   if two concurrent requests pass the application-level check simultaneously,
//   only one INSERT will succeed; the second receives a Mongo 11000 error which
//   we convert to a 409 → the frontend can treat that as "already recorded".
const recordInterestEntry = async (req, res) => {
  const { userId } = req.params;
  const {
    periodStart,
    periodEnd,
    date,
    note,
  } = req.body;

  if (!periodStart || !periodEnd || !date) {
    return res.status(400).json({
      message: "periodStart, periodEnd, and date are required",
    });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const parsedPeriodStart = new Date(periodStart);
  const parsedPeriodEnd = new Date(periodEnd);
  const parsedDate = new Date(date);
  if (
    [parsedPeriodStart, parsedPeriodEnd, parsedDate].some((value) =>
      Number.isNaN(value.getTime()),
    )
  ) {
    return res.status(400).json({ message: "Interest dates must be valid" });
  }

  // Recalculate the period server-side. This prevents altered amounts and
  // prevents a partial period from permanently occupying a full period's key.
  const transactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
  });
  const calculatedPeriod = calculateInterestPeriods(
    transactions,
    parsedPeriodEnd,
  ).find(
    (period) =>
      Math.abs(period.periodStart - parsedPeriodStart) < 24 * 60 * 60 * 1000,
  );

  if (!calculatedPeriod || calculatedPeriod.isPartial) {
    return res.status(400).json({
      message: "Only completed 28-day interest periods can be recorded",
    });
  }

  // ── Idempotency check ──────────────────────────────────────────────────────
  // The unique index enforces this at DB level too, but an explicit pre-check
  // gives a clean 409 instead of a raw duplicate-key error.
  const existing = await LoanTransaction.findOne({
    user: userId,
    type: "interest",
    "interestPeriod.periodStart": {
      $gte: new Date(parsedPeriodStart.getTime() - 12 * 60 * 60 * 1000), // ±12 h window
      $lte: new Date(parsedPeriodStart.getTime() + 12 * 60 * 60 * 1000),
    },
  });

  if (existing) {
    return res.status(409).json({
      message: "Interest for this period has already been recorded",
      existing,
    });
  }

  try {
    const transaction = await LoanTransaction.create({
      user: userId,
      type: "interest",
      amount: calculatedPeriod.interestAmount,
      date: parsedDate,
      note:
        note ||
        `Interest: 1% of ₹${calculatedPeriod.principalBalance.toFixed(2)} for period ${calculatedPeriod.periodStart.toLocaleDateString()} – ${calculatedPeriod.periodEnd.toLocaleDateString()}`,
      entrySource: "manual",
      recordedBy: req.user._id,
      interestPeriod: {
        periodStart: calculatedPeriod.periodStart,
        periodEnd: calculatedPeriod.periodEnd,
        principalBalance: calculatedPeriod.principalBalance,
        interestRate: calculatedPeriod.interestRate,
      },
    });
    return res.status(201).json(transaction);
  } catch (err) {
    // Duplicate-key from the unique index (race condition backstop)
    if (err.code === 11000) {
      const existing2 = await LoanTransaction.findOne({
        user: userId,
        type: "interest",
        "interestPeriod.periodStart": {
          $gte: new Date(parsedPeriodStart.getTime() - 12 * 60 * 60 * 1000),
          $lte: new Date(parsedPeriodStart.getTime() + 12 * 60 * 60 * 1000),
        },
      });
      return res.status(409).json({
        message: "Interest for this period has already been recorded",
        existing: existing2,
      });
    }
    throw err;
  }
};

// ─── ADMIN: Apply ALL unrecorded interest periods to the balance ───────────────
// POST /api/admin/loans/:userId/interest/apply-unrecorded
// Body: { toDate?: string }  (ISO date; defaults to today)
//
// Manual and automatic application share the same atomic-upsert service. The
// unique (user, periodStart) index remains the database-level duplicate guard.
const applyUnrecordedInterest = async (req, res) => {
  const { userId } = req.params;
  const { toDate } = req.body;

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const targetDate = toDate ? new Date(toDate) : new Date();
  if (Number.isNaN(targetDate.getTime())) {
    return res.status(400).json({ message: "toDate must be valid" });
  }

  const result = await applyDueInterestForUser({
    userId,
    toDate: targetDate,
    source: "manual",
    recordedBy: req.user._id,
  });

  if (result.transactionsFound === 0) {
    return res
      .status(400)
      .json({ message: "No transactions found for this user" });
  }

  return res.json({
    message:
      result.periodsApplied > 0
        ? "Unrecorded interest periods applied"
        : "No unrecorded interest periods to apply",
    periodsApplied: result.periodsApplied,
    duePeriodsFound: result.duePeriodsFound,
    totalApplied: result.totalApplied,
    updatedInterestBalance: result.summary.interestBalance,
    updatedInterestAccrued: result.summary.totalInterestAccrued,
    updatedInterestRepaid: result.summary.totalInterestRepaid,
    updatedTotalOutstanding: result.summary.totalOutstanding,
  });
};

// ─── ADMIN: Calculate interest to date (preview, not saved) ───────────────────
// GET /api/admin/loans/:userId/interest/calculate?toDate=2026-03-29
const calculateInterestToDate = async (req, res) => {
  const { userId } = req.params;
  const { toDate } = req.query;

  const user = await User.findById(userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });

  const transactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
  });

  if (transactions.length === 0) {
    return res.json({
      user,
      periods: [],
      totalInterestToDate: 0,
      totalAlreadyRecorded: 0,
      totalUnrecorded: 0,
      projectedPartialInterest: 0,
    });
  }

  const targetDate = toDate ? new Date(toDate) : new Date();
  const periods = calculateInterestPeriods(transactions, targetDate);

  const totalInterestToDate = periods.reduce(
    (sum, p) => sum + p.interestAmount,
    0,
  );
  const totalAlreadyRecorded = periods
    .filter((p) => p.alreadyRecorded)
    .reduce((sum, p) => sum + p.interestAmount, 0);
  const totalUnrecorded = periods
    .filter((p) => !p.alreadyRecorded && !p.isPartial)
    .reduce((sum, p) => sum + p.interestAmount, 0);
  const projectedPartialInterest = periods
    .filter((p) => !p.alreadyRecorded && p.isPartial)
    .reduce((sum, p) => sum + p.interestAmount, 0);

  const summary = computeLoanSummary(transactions);

  res.json({
    user,
    summary,
    periods,
    totalInterestToDate: parseFloat(totalInterestToDate.toFixed(2)),
    totalAlreadyRecorded: parseFloat(totalAlreadyRecorded.toFixed(2)),
    totalUnrecorded: parseFloat(totalUnrecorded.toFixed(2)),
    projectedPartialInterest: parseFloat(projectedPartialInterest.toFixed(2)),
  });
};

// ─── ADMIN: Preview a full loan settlement (no writes) ───────────────────────
// GET /api/admin/loans/:userId/close/preview?closeDate=YYYY-MM-DD
const previewLoanClosure = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select("name email role");
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const transactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
    createdAt: 1,
  });
  try {
    const preview = buildLoanClosurePreview(
      transactions,
      req.query.closeDate,
    );
    return res.json({ user, ...preview });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ─── ADMIN: Apply due interest and atomically record a full settlement ───────
// POST /api/admin/loans/:userId/close
// Body: { closeDate, expectedTotal, note? }
const closeLoan = async (req, res) => {
  const { userId } = req.params;
  const { closeDate, expectedTotal, note = "" } = req.body || {};
  const user = await User.findById(userId).select("name email role");
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const initialTransactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
    createdAt: 1,
  });
  try {
    // Validate before performing the completed-period catch-up.
    buildLoanClosurePreview(initialTransactions, closeDate);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const parsedExpectedTotal = Number(expectedTotal);
  if (!Number.isFinite(parsedExpectedTotal) || parsedExpectedTotal <= 0) {
    return res.status(400).json({
      message: "expectedTotal from a current closure preview is required",
    });
  }

  // Uses the same idempotent upserts as manual/automatic interest. If the
  // scheduler races this request, each completed period is still created once.
  const appliedInterest = await applyDueInterestForUser({
    userId,
    toDate: new Date(`${closeDate}T00:00:00.000Z`),
    source: "manual",
    recordedBy: req.user._id,
  });
  const transactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
    createdAt: 1,
  });

  let preview;
  try {
    preview = buildLoanClosurePreview(transactions, closeDate);
  } catch (error) {
    return res.status(409).json({ message: error.message });
  }
  if (Math.abs(parsedExpectedTotal - preview.totalSettlement) > 0.01) {
    return res.status(409).json({
      message:
        "The loan balance changed after the preview. Review the updated settlement before closing.",
      preview,
    });
  }

  const closureDocument = buildLoanClosureDocument({
    userId,
    closeDate: preview.closeDate,
    preview,
    note,
    recordedBy: req.user._id,
  });

  try {
    const closure = await LoanTransaction.create(closureDocument);
    const updatedSummary = computeLoanSummary([...transactions, closure]);
    return res.status(201).json({
      message: "Loan closed and full settlement recorded",
      closure,
      appliedCompletedPeriods: appliedInterest.periodsApplied,
      appliedCompletedInterest: appliedInterest.totalApplied,
      summary: updatedSummary,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This loan cycle has already been closed",
      });
    }
    throw error;
  }
};

// ─── ADMIN: Get full loan ledger for a user ───────────────────────────────────
// GET /api/admin/loans/:userId
const getUserLoanDetail = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });

  const transactions = await LoanTransaction.find({ user: userId })
    .sort({ date: -1 })
    .populate("recordedBy", "name");

  const summary = computeLoanSummary(transactions);

  res.json({
    user,
    summary,
    transactions,
  });
};

// ─── ADMIN: Overview of all users' loan balances ──────────────────────────────
// GET /api/admin/loans
const getAllUsersLoanOverview = async (req, res) => {
  const allTransactions = await LoanTransaction.find({}).sort({ date: 1 });

  // Group transactions by user
  const userMap = {};
  for (const tx of allTransactions) {
    const uid = String(tx.user);
    if (!userMap[uid]) userMap[uid] = [];
    userMap[uid].push(tx);
  }

  // Compute summary per user
  const summaries = Object.entries(userMap).map(([userId, txs]) => {
    const summary = computeLoanSummary(txs);
    return { userId, ...summary };
  });

  // Fetch user info
  const userIds = summaries.map((s) => s.userId);
  const users = await User.find({ _id: { $in: userIds } }).select("name email");
  const userInfoMap = {};
  for (const u of users) {
    userInfoMap[String(u._id)] = u;
  }

  const result = summaries.map((s) => ({
    userId: s.userId,
    name: userInfoMap[s.userId]?.name || "Unknown",
    email: userInfoMap[s.userId]?.email || "",
    totalDisbursed: s.totalDisbursed,
    totalPrincipalRepaid: s.totalPrincipalRepaid,
    totalInterestAccrued: s.totalInterestAccrued,
    totalFines: s.totalFines,
    totalInterestRepaid: s.totalInterestRepaid,
    principalBalance: s.principalBalance,
    interestBalance: s.interestBalance,
    totalOutstanding: s.totalOutstanding,
  }));

  result.sort((a, b) => a.name.localeCompare(b.name));

  res.json(result);
};

// ─── USER: View own loan summary ──────────────────────────────────────────────
// GET /api/users/loans/me
const getMyLoanSummary = async (req, res) => {
  const userId = req.user._id;

  const transactions = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
  });

  const summary = computeLoanSummary(transactions);

  // Build full transaction history for the client (all types visible)
  const history = transactions.map((tx) => ({
    _id: tx._id,
    type: tx.type,
    amount: tx.amount,
    paymentTarget: tx.paymentTarget,
    date: tx.date,
    note: tx.note,
    interestPeriod: tx.interestPeriod,
    closureDetails: tx.closureDetails,
  }));

  res.json({
    principalBalance: summary.principalBalance,
    interestBalance: summary.interestBalance,
    totalOutstanding: summary.totalOutstanding,
    totalDisbursed: summary.totalDisbursed,
    totalPrincipalRepaid: summary.totalPrincipalRepaid,
    totalInterestAccrued: summary.totalInterestAccrued,
    totalInterestRepaid: summary.totalInterestRepaid,
    totalFines: summary.totalFines,
    history,
  });
};

// ─── ADMIN: Hard-delete a loan transaction with audit log ─────────────────────
// DELETE /api/admin/loans/:userId/transaction/:transactionId
// Body (optional): { reason?: string }
//
// Idempotent balance recalculation:
//   The summary is recomputed from scratch using all REMAINING transactions
//   after deletion, so the balances are always deterministic regardless of the
//   order transactions were entered.
const deleteLoanTransaction = async (req, res) => {
  const { userId, transactionId } = req.params;
  const { reason = "" } = req.body || {};

  // 1. Verify the user exists
  const user = await User.findById(userId).select("name role");
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  // 2. Verify the transaction exists and belongs to this user
  const tx = await LoanTransaction.findOne({
    _id: transactionId,
    user: userId,
  });
  if (!tx) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // 3. Compute summary BEFORE deletion for the audit log
  const allTxBefore = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
  });
  const summaryBefore = computeLoanSummary(allTxBefore);

  // 4. Hard-delete the transaction
  await LoanTransaction.deleteOne({ _id: transactionId });

  // 5. Recompute summary from remaining transactions (single deterministic pass)
  const allTxAfter = await LoanTransaction.find({ user: userId }).sort({
    date: 1,
  });
  const summaryAfter = computeLoanSummary(allTxAfter);

  // 6. Write audit log (non-blocking — a failure here must not undo the deletion)
  try {
    await AuditLog.create({
      adminId: req.user._id,
      adminName: req.user.name || "",
      action: "DELETE_LOAN_TRANSACTION",
      userId,
      deletedRecordId: transactionId,
      deletedRecord: {
        type: tx.type,
        amount: tx.amount,
        date: tx.date,
        note: tx.note,
        paymentTarget: tx.paymentTarget,
        interestPeriod: tx.interestPeriod,
        closureDetails: tx.closureDetails,
        closureKey: tx.closureKey,
      },
      summaryBefore,
      summaryAfter,
      reason,
    });
  } catch (auditErr) {
    // Log but do not fail the request — the deletion already succeeded
    console.error("[AuditLog] Failed to write audit log:", auditErr.message);
  }

  return res.json({
    success: true,
    deletedTransactionId: transactionId,
    userId,
    summaryAfter,
  });
};

export {
  addLoanTransaction,
  applyUnrecordedInterest,
  recordInterestEntry,
  calculateInterestToDate,
  previewLoanClosure,
  closeLoan,
  getUserLoanDetail,
  getAllUsersLoanOverview,
  getMyLoanSummary,
  computeLoanSummary,
  calculateInterestPeriods,
  deleteLoanTransaction,
};
