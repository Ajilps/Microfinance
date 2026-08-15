import { createHash } from "node:crypto";

import ExtraTransaction from "../models/extraTransactionModel.js";
import FinePayment from "../models/finePaymentModel.js";
import LoanTransaction from "../models/loanModel.js";
import ProfitDistribution from "../models/profitDistributionModel.js";
import SavingsPayment from "../models/savingsModel.js";
import SavingsWithdrawal from "../models/savingsWithdrawalModel.js";
import User from "../models/userModel.js";
import { computeLoanSummary } from "../services/loanLedgerService.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const createDistributionCalculationKey = ({
  asOfDate,
  summary,
  amount,
  allocations,
}) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        version: 1,
        asOfDate,
        amount: roundMoney(amount),
        cashProfit: summary.cashProfit,
        previouslyDistributed: summary.previouslyDistributed,
        availableToDistribute: summary.availableToDistribute,
        savings: allocations.map((allocation) => [
          String(allocation.userId),
          allocation.savingsBalance,
        ]),
      }),
    )
    .digest("hex");

const getAsOfRange = (value) => {
  if (!value || typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error("asOfDate must use YYYY-MM-DD format");
  }
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) {
    throw new Error("asOfDate must be a valid date");
  }
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (start > today) {
    throw new Error("asOfDate cannot be in the future");
  }
  const endExclusive = new Date(start);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  return { start, endExclusive, value };
};

const buildProfitSummary = ({
  loans,
  extras,
  distributions,
  finePayments = [],
}) => {
  const loanSummary = computeLoanSummary(loans);
  const otherIncome = extras
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const otherExpenses = extras
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const previouslyDistributed = distributions
    .filter((item) => item.status !== "reversed")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const attendanceFineIncome = finePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  // Principal repayments are a return of capital, not revenue.
  const totalReturn =
    loanSummary.totalPrincipalRepaid + loanSummary.totalInterestRepaid;
  const revenue =
    loanSummary.totalInterestAccrued +
    loanSummary.totalFines +
    attendanceFineIncome +
    otherIncome;
  const expenses = otherExpenses;
  const accruedProfit = revenue - expenses;
  const cashRevenue =
    loanSummary.totalInterestRepaid + attendanceFineIncome + otherIncome;
  const cashProfit = cashRevenue - expenses;
  const availableToDistribute = Math.max(0, cashProfit - previouslyDistributed);
  const unpaidInterest = Math.max(
    0,
    loanSummary.totalInterestAccrued - loanSummary.totalInterestRepaid,
  );

  return {
    totalLoanDistributed: roundMoney(loanSummary.totalDisbursed),
    totalPrincipalPaid: roundMoney(loanSummary.totalPrincipalRepaid),
    totalReturn: roundMoney(totalReturn),
    totalInterestGenerated: roundMoney(loanSummary.totalInterestAccrued),
    totalInterestPaid: roundMoney(loanSummary.totalInterestRepaid),
    totalUnpaidLoan: roundMoney(loanSummary.principalBalance),
    unpaidInterest: roundMoney(unpaidInterest),
    loanFinesGenerated: roundMoney(loanSummary.totalFines),
    attendanceFineIncome: roundMoney(attendanceFineIncome),
    otherIncome: roundMoney(otherIncome),
    otherExpenses: roundMoney(otherExpenses),
    revenue: roundMoney(revenue),
    expenses: roundMoney(expenses),
    accruedProfit: roundMoney(accruedProfit),
    cashRevenue: roundMoney(cashRevenue),
    cashProfit: roundMoney(cashProfit),
    previouslyDistributed: roundMoney(previouslyDistributed),
    availableToDistribute: roundMoney(availableToDistribute),
  };
};

const buildProfitAllocations = ({
  users,
  savingsPayments,
  savingsWithdrawals = [],
  amount,
}) => {
  const amountCents = Math.round(Number(amount || 0) * 100);
  const balances = new Map();
  for (const payment of savingsPayments) {
    const userId = String(payment.user?._id || payment.user);
    balances.set(
      userId,
      (balances.get(userId) || 0) + Number(payment.amount || 0),
    );
  }
  for (const withdrawal of savingsWithdrawals) {
    const userId = String(withdrawal.user?._id || withdrawal.user);
    balances.set(
      userId,
      (balances.get(userId) || 0) - Number(withdrawal.amount || 0),
    );
  }

  const eligibleUsers = users
    .map((user) => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      savingsBalance: roundMoney(balances.get(String(user._id)) || 0),
    }))
    .filter((user) => user.savingsBalance > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
  const totalSavings = roundMoney(
    eligibleUsers.reduce((sum, user) => sum + user.savingsBalance, 0),
  );

  if (amountCents <= 0 || totalSavings <= 0) {
    return { totalSavings, allocations: [] };
  }

  const rawAllocations = eligibleUsers.map((user) => {
    const rawCents = (amountCents * user.savingsBalance) / totalSavings;
    const cents = Math.floor(rawCents);
    return { ...user, rawCents, cents, remainder: rawCents - cents };
  });
  let remainingCents =
    amountCents -
    rawAllocations.reduce((sum, allocation) => sum + allocation.cents, 0);
  const remainderOrder = [...rawAllocations].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      String(left.userId).localeCompare(String(right.userId)),
  );
  for (let index = 0; index < remainingCents; index += 1) {
    remainderOrder[index % remainderOrder.length].cents += 1;
  }

  const allocations = rawAllocations.map(
    ({ rawCents: _rawCents, remainder: _remainder, cents, ...user }) => ({
      ...user,
      sharePercent: Number(
        ((user.savingsBalance / totalSavings) * 100).toFixed(4),
      ),
      amount: Number((cents / 100).toFixed(2)),
    }),
  );

  return { totalSavings, allocations };
};

const loadProfitData = async (asOfDate, requestedAmount) => {
  const range = getAsOfRange(asOfDate);
  const dateFilter = { $lt: range.endExclusive };
  const [
    loans,
    extras,
    distributions,
    users,
    savingsPayments,
    savingsWithdrawals,
    finePayments,
  ] =
    await Promise.all([
      LoanTransaction.find({ date: dateFilter }).sort({ date: 1 }),
      ExtraTransaction.find({ transactionDate: dateFilter }),
      ProfitDistribution.find({ distributionDate: dateFilter }),
      User.find({ role: "user" }).select("name email").sort({ name: 1 }),
      SavingsPayment.find({ paidOn: dateFilter }),
      SavingsWithdrawal.find({ withdrawalDate: dateFilter }),
      FinePayment.find({ paidOn: dateFilter }),
    ]);

  const summary = buildProfitSummary({
    loans,
    extras,
    distributions,
    finePayments,
  });
  const parsedAmount =
    requestedAmount === undefined || requestedAmount === ""
      ? summary.availableToDistribute
      : Number(requestedAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error("amount must be zero or greater");
  }
  if (roundMoney(parsedAmount) > summary.availableToDistribute) {
    throw new Error(
      `amount cannot exceed available cash profit of ₹${summary.availableToDistribute.toFixed(2)}`,
    );
  }

  const allocation = buildProfitAllocations({
    users,
    savingsPayments,
    savingsWithdrawals,
    amount: roundMoney(parsedAmount),
  });
  const calculationKey = createDistributionCalculationKey({
    asOfDate: range.value,
    summary,
    amount: parsedAmount,
    allocations: allocation.allocations,
  });
  return {
    asOfDate: range.value,
    summary,
    distributionAmount: roundMoney(parsedAmount),
    calculationKey,
    ...allocation,
  };
};

const getProfitOverview = async (req, res) => {
  try {
    const data = await loadProfitData(req.query.asOfDate, req.query.amount);
    return res.json(data);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

const createProfitDistribution = async (req, res) => {
  const note = typeof req.body.note === "string" ? req.body.note.trim() : "";
  if (note.length > 1000) {
    return res.status(400).json({ message: "Note cannot exceed 1000 characters" });
  }

  try {
    const data = await loadProfitData(req.body.asOfDate, req.body.amount);
    if (data.distributionAmount <= 0) {
      return res
        .status(400)
        .json({ message: "Distribution amount must be greater than 0" });
    }
    if (data.allocations.length === 0 || data.totalSavings <= 0) {
      return res.status(400).json({
        message: "No member savings are available for profit allocation",
      });
    }
    const selectedDayEnd = new Date(`${data.asOfDate}T23:59:59.999Z`);
    const laterDistribution = await ProfitDistribution.findOne({
      distributionDate: { $gt: selectedDayEnd },
      status: { $ne: "reversed" },
    }).select("_id");
    if (laterDistribution) {
      return res.status(409).json({
        message:
          "A later profit distribution already exists. New distributions cannot be recorded retroactively.",
      });
    }

    const distribution = await ProfitDistribution.create({
      asOfDate: new Date(`${data.asOfDate}T00:00:00.000Z`),
      distributionDate: new Date(`${data.asOfDate}T12:00:00.000Z`),
      amount: data.distributionAmount,
      calculationKey: data.calculationKey,
      totalSavings: data.totalSavings,
      allocations: data.allocations.map((allocation) => ({
        user: allocation.userId,
        name: allocation.name,
        email: allocation.email,
        savingsBalance: allocation.savingsBalance,
        sharePercent: allocation.sharePercent,
        amount: allocation.amount,
      })),
      summarySnapshot: data.summary,
      note,
      recordedBy: req.user._id,
    });
    await distribution.populate("recordedBy", "name");
    return res.status(201).json(distribution);
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.calculationKey) {
      return res.status(409).json({
        message:
          "This profit allocation has already been recorded. Refresh the totals before creating another distribution.",
      });
    }
    return res.status(400).json({ message: error.message });
  }
};

const unallocateProfitDistribution = async (req, res) => {
  const reason =
    typeof req.body.reason === "string" ? req.body.reason.trim() : "";
  if (reason.length > 1000) {
    return res.status(400).json({
      message: "Un-allocation reason cannot exceed 1000 characters",
    });
  }

  const distribution = await ProfitDistribution.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $ne: "reversed" },
      unallocationLocked: { $ne: true },
    },
    {
      $set: {
        status: "reversed",
        reversedAt: new Date(),
        reversedBy: req.user._id,
        reversalReason: reason,
      },
    },
    { new: true, runValidators: true },
  ).populate([
    { path: "recordedBy", select: "name" },
    { path: "reversedBy", select: "name" },
  ]);

  if (distribution) {
    return res.json(distribution);
  }

  const existing = await ProfitDistribution.findById(req.params.id).select(
    "status unallocationLocked",
  );
  if (!existing) {
    return res.status(404).json({ message: "Profit distribution not found" });
  }
  return res.status(409).json({
    message: existing.unallocationLocked
      ? "Un-allocation has been permanently disabled for this distribution"
      : "This profit distribution has already been un-allocated",
  });
};

const lockProfitDistributionUnallocation = async (req, res) => {
  const distribution = await ProfitDistribution.findOneAndUpdate(
    {
      _id: req.params.id,
      status: { $ne: "reversed" },
      unallocationLocked: { $ne: true },
    },
    {
      $set: {
        unallocationLocked: true,
        unallocationLockedAt: new Date(),
        unallocationLockedBy: req.user._id,
      },
    },
    { new: true, runValidators: true },
  ).populate([
    { path: "recordedBy", select: "name" },
    { path: "unallocationLockedBy", select: "name" },
  ]);

  if (distribution) {
    return res.json(distribution);
  }

  const existing = await ProfitDistribution.findById(req.params.id).select(
    "status unallocationLocked",
  );
  if (!existing) {
    return res.status(404).json({ message: "Profit distribution not found" });
  }
  return res.status(409).json({
    message:
      existing.status === "reversed"
        ? "An un-allocated distribution cannot be locked"
        : "Un-allocation is already disabled for this distribution",
  });
};

const getProfitDistributions = async (req, res) => {
  const distributions = await ProfitDistribution.find()
    .sort({ distributionDate: -1, createdAt: -1 })
    .populate([
      { path: "recordedBy", select: "name" },
      { path: "reversedBy", select: "name" },
      { path: "unallocationLockedBy", select: "name" },
    ]);
  return res.json(distributions);
};

export {
  buildProfitAllocations,
  buildProfitSummary,
  createDistributionCalculationKey,
  createProfitDistribution,
  getAsOfRange,
  getProfitDistributions,
  getProfitOverview,
  loadProfitData,
  lockProfitDistributionUnallocation,
  unallocateProfitDistribution,
};
