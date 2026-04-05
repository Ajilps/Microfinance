import LoanTransaction from "../models/loanModel.js";
import User from "../models/userModel.js";

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

// ─── ADMIN: Apply unrecorded interest to loan balance ──────────────────────
// POST /api/admin/loans/:userId/interest/apply-unrecorded
// Body: { amount }
const applyUnrecordedInterest = async (req, res) => {
  const { userId } = req.params;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Valid positive amount is required" });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  const transaction = await LoanTransaction.create({
    user: userId,
    type: "interest",
    amount: parseFloat(amount),
    date: new Date(),
    note: `Applied unrecorded interest: ₹${parseFloat(amount).toFixed(2)}`,
    recordedBy: req.user._id,
    interestPeriod: {
      periodStart: null,
      periodEnd: null,
      principalBalance: null,
      interestRate: 0.01,
    },
  });

  const transactions = await LoanTransaction.find({ user: userId }).sort({ date: 1 });
  const summary = computeLoanSummary(transactions);

  res.status(201).json({
    transaction,
    updatedInterestBalance: summary.interestBalance,
    updatedInterestAccrued: summary.totalInterestAccrued,
    updatedInterestRepaid: summary.totalInterestRepaid,
    updatedTotalOutstanding: summary.totalOutstanding,
  });
};

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

  const transaction = await LoanTransaction.create({
    user: userId,
    type: "interest",
    amount: parseFloat(interestAmount),
    date: new Date(date),
    note:
      note ||
      `Interest: 1% of ₹${principalBalance?.toFixed(2)} for period ${new Date(periodStart).toLocaleDateString()} – ${new Date(periodEnd).toLocaleDateString()}`,
    recordedBy: req.user._id,
    interestPeriod: {
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      principalBalance: parseFloat(principalBalance || 0),
      interestRate: parseFloat(interestRate || 0.01),
    },
  });

  res.status(201).json(transaction);
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
};
