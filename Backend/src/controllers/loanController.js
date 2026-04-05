import LoanTransaction from "../models/loanModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";

// ─── Helper: compute separated principal and interest balances ─────────────────
/**
 * Computes loan summary with STRICTLY SEPARATED principal and interest balances.
 *
 * Principal balance:
 *   = sum(loan disbursements) - sum(repayments where paymentTarget='principal')
 *
 * Interest balance:
 *   = sum(interest entries) + sum(fines) - sum(repayments where paymentTarget='interest')
 *
 * Interest is NEVER added to principal. Principal remains static unless a
 * direct principal repayment is made.
 */
const computeLoanSummary = (transactions) => {
  let totalDisbursed = 0;
  let totalPrincipalRepaid = 0;
  let totalInterestAccrued = 0;
  let totalFines = 0;
  let totalInterestRepaid = 0;

  for (const tx of transactions) {
    if (tx.type === "loan") {
      totalDisbursed += tx.amount;
    } else if (tx.type === "interest") {
      totalInterestAccrued += tx.amount;
    } else if (tx.type === "fine") {
      totalFines += tx.amount;
    } else if (tx.type === "repayment") {
      if (tx.paymentTarget === "principal") {
        totalPrincipalRepaid += tx.amount;
      } else if (tx.paymentTarget === "interest") {
        totalInterestRepaid += tx.amount;
      } else {
        // Legacy repayments without paymentTarget: apply to interest first, then principal
        const remainingInterest =
          totalInterestAccrued + totalFines - totalInterestRepaid;
        if (remainingInterest > 0) {
          const toInterest = Math.min(tx.amount, remainingInterest);
          totalInterestRepaid += toInterest;
          totalPrincipalRepaid += tx.amount - toInterest;
        } else {
          totalPrincipalRepaid += tx.amount;
        }
      }
    }
  }

  const principalBalance = Math.max(0, totalDisbursed - totalPrincipalRepaid);
  const interestBalance = Math.max(
    0,
    totalInterestAccrued + totalFines - totalInterestRepaid,
  );

  return {
    totalDisbursed,
    totalPrincipalRepaid,
    totalInterestAccrued,
    totalFines,
    totalInterestRepaid,
    principalBalance,
    interestBalance,
    totalOutstanding: principalBalance + interestBalance,
  };
};

// ─── Helper: calculate interest periods from loan start to a given date ────────
/**
 * Generates a breakdown of all 4-week interest periods from the first loan
 * disbursement date up to the target date.
 *
 * Interest is always 1% of the PRINCIPAL BALANCE at the time of each period.
 * Principal balance only changes when principal repayments are made.
 */
const calculateInterestPeriods = (transactions, toDate = new Date()) => {
  if (!transactions || transactions.length === 0) return [];

  // Find the first loan disbursement
  const firstLoan = transactions.find((tx) => tx.type === "loan");
  if (!firstLoan) return [];

  const startDate = new Date(firstLoan.date);
  const endDate = new Date(toDate);

  if (startDate >= endDate) return [];

  // Build a timeline of principal changes
  // Principal only changes on: loan disbursements and principal repayments
  const principalEvents = transactions
    .filter(
      (tx) =>
        tx.type === "loan" ||
        (tx.type === "repayment" && tx.paymentTarget === "principal"),
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Get principal balance at a given date
  const getPrincipalAtDate = (date) => {
    let principal = 0;
    for (const tx of principalEvents) {
      if (new Date(tx.date) <= date) {
        if (tx.type === "loan") principal += tx.amount;
        else if (tx.type === "repayment") principal -= tx.amount;
      }
    }
    return Math.max(0, principal);
  };

  // Get already-recorded interest transactions
  const recordedInterest = transactions
    .filter((tx) => tx.type === "interest")
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const periods = [];
  let periodStart = new Date(startDate);
  const PERIOD_DAYS = 28;

  while (periodStart < endDate) {
    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + PERIOD_DAYS);

    const isPartial = periodEnd > endDate;
    const actualPeriodEnd = isPartial ? new Date(endDate) : new Date(periodEnd);

    // Calculate days in this period
    const daysInPeriod = Math.floor(
      (actualPeriodEnd - periodStart) / (1000 * 60 * 60 * 24),
    );

    // Get principal balance at the start of this period
    const principalAtPeriodStart = getPrincipalAtDate(periodStart);

    if (principalAtPeriodStart <= 0) {
      periodStart = new Date(periodEnd);
      continue;
    }

    // For full periods: 1% flat. For partial: pro-rate by days
    const interestRate = 0.01;
    let interestAmount;
    if (isPartial) {
      interestAmount = parseFloat(
        (
          (principalAtPeriodStart * interestRate * daysInPeriod) /
          PERIOD_DAYS
        ).toFixed(2),
      );
    } else {
      interestAmount = parseFloat(
        (principalAtPeriodStart * interestRate).toFixed(2),
      );
    }

    // Check if this period already has a recorded interest transaction
    const alreadyRecorded = recordedInterest.find((tx) => {
      if (tx.interestPeriod && tx.interestPeriod.periodStart) {
        const txPeriodStart = new Date(tx.interestPeriod.periodStart);
        return Math.abs(txPeriodStart - periodStart) < 1000 * 60 * 60 * 24; // within 1 day
      }
      return false;
    });

    periods.push({
      periodStart: new Date(periodStart),
      periodEnd: new Date(actualPeriodEnd),
      daysInPeriod,
      isPartial,
      principalBalance: principalAtPeriodStart,
      interestRate,
      interestAmount,
      alreadyRecorded: !!alreadyRecorded,
      recordedTransactionId: alreadyRecorded?._id || null,
    });

    periodStart = new Date(periodEnd);
  }

  return periods;
};

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

  const transactionData = {
    user: userId,
    type,
    amount: parseFloat(amount),
    date: new Date(date),
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
    principalBalance,
    interestRate,
    interestAmount,
    date,
    note,
  } = req.body;

  if (!periodStart || !periodEnd || !interestAmount || !date) {
    return res.status(400).json({
      message: "periodStart, periodEnd, interestAmount, and date are required",
    });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const parsedPeriodStart = new Date(periodStart);

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
      amount: parseFloat(interestAmount),
      date: new Date(date),
      note:
        note ||
        `Interest: 1% of ₹${parseFloat(principalBalance || 0).toFixed(2)} for period ${parsedPeriodStart.toLocaleDateString()} – ${new Date(periodEnd).toLocaleDateString()}`,
      recordedBy: req.user._id,
      interestPeriod: {
        periodStart: parsedPeriodStart,
        periodEnd: new Date(periodEnd),
        principalBalance: parseFloat(principalBalance || 0),
        interestRate: parseFloat(interestRate || 0.01),
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
// ROOT CAUSE of prior bug:
//   The old version created a SINGLE transaction with periodStart=null.
//   calculateInterestPeriods matches periods by periodStart (±1 day), so a
//   null-period entry was NEVER matched, meaning totalUnrecorded never dropped
//   to 0, and the button could be clicked repeatedly to add unlimited interest.
//
// Fix:
//   Re-derive the full list of unrecorded periods server-side (same logic as
//   calculateInterestToDate), then record each period individually using the
//   same idempotent path as recordInterestEntry.  The unique index on
//   (user, interestPeriod.periodStart) makes this inherently idempotent:
//   a period that was already recorded will produce a duplicate-key error which
//   we silently skip.
const applyUnrecordedInterest = async (req, res) => {
  const { userId } = req.params;
  const { toDate } = req.body;

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  // Fetch the live ledger — never trust the amount sent from the browser
  const transactions = await LoanTransaction.find({ user: userId }).sort({ date: 1 });

  if (transactions.length === 0) {
    return res.status(400).json({ message: "No transactions found for this user" });
  }

  const targetDate = toDate ? new Date(toDate) : new Date();
  const periods = calculateInterestPeriods(transactions, targetDate);
  const unrecordedPeriods = periods.filter((p) => !p.alreadyRecorded && !p.isPartial);

  if (unrecordedPeriods.length === 0) {
    // Nothing to apply — fetch fresh summary and return it
    const summary = computeLoanSummary(transactions);
    return res.json({
      message: "No unrecorded interest periods to apply",
      periodsApplied: 0,
      updatedInterestBalance: summary.interestBalance,
      updatedInterestAccrued: summary.totalInterestAccrued,
      updatedInterestRepaid: summary.totalInterestRepaid,
      updatedTotalOutstanding: summary.totalOutstanding,
    });
  }

  const now = new Date();
  let periodsApplied = 0;
  let totalApplied = 0;

  for (const period of unrecordedPeriods) {
    try {
      await LoanTransaction.create({
        user: userId,
        type: "interest",
        amount: period.interestAmount,
        date: now,
        note: `Interest: 1% of ₹${period.principalBalance.toFixed(2)} for ${period.periodStart.toLocaleDateString("en-IN")} – ${period.periodEnd.toLocaleDateString("en-IN")}`,
        recordedBy: req.user._id,
        interestPeriod: {
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          principalBalance: period.principalBalance,
          interestRate: period.interestRate,
        },
      });
      periodsApplied++;
      totalApplied += period.interestAmount;
    } catch (err) {
      if (err.code === 11000) {
        // Already recorded by a concurrent request — skip silently
        continue;
      }
      throw err;
    }
  }

  // Recompute summary from the now-updated ledger
  const updatedTransactions = await LoanTransaction.find({ user: userId }).sort({ date: 1 });
  const summary = computeLoanSummary(updatedTransactions);

  return res.json({
    periodsApplied,
    totalApplied: parseFloat(totalApplied.toFixed(2)),
    updatedInterestBalance: summary.interestBalance,
    updatedInterestAccrued: summary.totalInterestAccrued,
    updatedInterestRepaid: summary.totalInterestRepaid,
    updatedTotalOutstanding: summary.totalOutstanding,
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
    .filter((p) => !p.alreadyRecorded)
    .reduce((sum, p) => sum + p.interestAmount, 0);

  const summary = computeLoanSummary(transactions);

  res.json({
    user,
    summary,
    periods,
    totalInterestToDate: parseFloat(totalInterestToDate.toFixed(2)),
    totalAlreadyRecorded: parseFloat(totalAlreadyRecorded.toFixed(2)),
    totalUnrecorded: parseFloat(totalUnrecorded.toFixed(2)),
  });
};

// ─── ADMIN: Get full loan ledger for a user ───────────────────────────────────
// GET /api/admin/loans/:userId
const getUserLoanDetail = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });

  const transactions = await LoanTransaction.find({ user: userId })
    .sort({ date: 1 })
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
  const tx = await LoanTransaction.findOne({ _id: transactionId, user: userId });
  if (!tx) {
    return res.status(404).json({ message: "Transaction not found" });
  }

  // 3. Compute summary BEFORE deletion for the audit log
  const allTxBefore = await LoanTransaction.find({ user: userId }).sort({ date: 1 });
  const summaryBefore = computeLoanSummary(allTxBefore);

  // 4. Hard-delete the transaction
  await LoanTransaction.deleteOne({ _id: transactionId });

  // 5. Recompute summary from remaining transactions (single deterministic pass)
  const allTxAfter = await LoanTransaction.find({ user: userId }).sort({ date: 1 });
  const summaryAfter = computeLoanSummary(allTxAfter);

  // 6. Write audit log (non-blocking — a failure here must not undo the deletion)
  try {
    await AuditLog.create({
      adminId:   req.user._id,
      adminName: req.user.name || "",
      action:    "DELETE_LOAN_TRANSACTION",
      userId,
      deletedRecordId: transactionId,
      deletedRecord: {
        type:           tx.type,
        amount:         tx.amount,
        date:           tx.date,
        note:           tx.note,
        paymentTarget:  tx.paymentTarget,
        interestPeriod: tx.interestPeriod,
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
  getUserLoanDetail,
  getAllUsersLoanOverview,
  getMyLoanSummary,
  computeLoanSummary,
  calculateInterestPeriods,
  deleteLoanTransaction,
};
