import { createHash } from "node:crypto";

import {
  buildLoanCycles,
  calculateInterestPeriods,
  computeLoanSummary,
} from "./loanLedgerService.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const parseDateOnly = (value, fieldName = "closeDate") => {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return parsed;
};

const dateKeyInTimeZone = (date, timeZone = "Asia/Kolkata") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const validateCloseDate = (
  transactions,
  closeDateValue,
  { now = new Date(), timeZone = "Asia/Kolkata" } = {},
) => {
  const closeDate = parseDateOnly(closeDateValue);
  if (closeDateValue > dateKeyInTimeZone(now, timeZone)) {
    throw new Error("closeDate cannot be in the future");
  }

  const latestTransaction = [...transactions]
    .filter((transaction) => !Number.isNaN(new Date(transaction.date).getTime()))
    .sort((left, right) => new Date(right.date) - new Date(left.date))[0];
  if (
    latestTransaction &&
    closeDateValue < new Date(latestTransaction.date).toISOString().slice(0, 10)
  ) {
    throw new Error("closeDate cannot be earlier than the latest loan transaction");
  }
  return closeDate;
};

const buildLoanClosurePreview = (transactions, closeDateValue, options = {}) => {
  if (!transactions?.length) {
    throw new Error("No loan transactions found for this member");
  }

  const closeDate = validateCloseDate(transactions, closeDateValue, options);
  const summary = computeLoanSummary(transactions);
  const periods = calculateInterestPeriods(transactions, closeDate);
  const completedPeriods = periods.filter(
    (period) => !period.alreadyRecorded && !period.isPartial,
  );
  const partialPeriods = periods.filter(
    (period) => !period.alreadyRecorded && period.isPartial,
  );
  const unrecordedCompletedInterest = roundMoney(
    completedPeriods.reduce((sum, period) => sum + period.interestAmount, 0),
  );
  const projectedPartialInterest = roundMoney(
    partialPeriods.reduce((sum, period) => sum + period.interestAmount, 0),
  );
  const totalInterestDue = roundMoney(
    summary.interestBalance +
      unrecordedCompletedInterest +
      projectedPartialInterest,
  );
  const totalSettlement = roundMoney(
    summary.principalBalance + totalInterestDue,
  );
  if (totalSettlement <= 0) {
    throw new Error("This member has no unpaid loan balance to close");
  }
  const activeCycle = buildLoanCycles(transactions).at(-1);

  return {
    closeDate,
    principalDue: summary.principalBalance,
    existingInterestDue: summary.interestBalance,
    unrecordedCompletedInterest,
    projectedPartialInterest,
    totalInterestDue,
    totalSettlement,
    completedPeriods,
    partialPeriods,
    activeCycleStart: activeCycle?.start || null,
  };
};

const buildClosureKey = (userId, activeCycleStart) => {
  if (!activeCycleStart) throw new Error("Active loan cycle was not found");
  const cycleIdentity = `${userId}:${new Date(activeCycleStart).toISOString()}`;
  return `loan-close:${createHash("sha256").update(cycleIdentity).digest("hex")}`;
};

const buildLoanClosureDocument = ({
  userId,
  closeDate,
  preview,
  note,
  recordedBy,
}) => {
  const interestPeriods = preview.partialPeriods.map((period) => ({
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    principalBalance: period.principalBalance,
    interestRate: period.interestRate,
    interestAmount: period.interestAmount,
    daysInPeriod: period.daysInPeriod,
    isPartial: true,
  }));
  const document = {
    user: userId,
    type: "closure",
    amount: preview.totalSettlement,
    date: closeDate,
    note: note?.trim() || "Loan closed after full settlement",
    entrySource: "manual",
    closureKey: buildClosureKey(userId, preview.activeCycleStart),
    closureDetails: {
      principalPaid: preview.principalDue,
      existingInterestPaid: preview.existingInterestDue,
      interestCharged: preview.projectedPartialInterest,
      interestPaid: preview.totalInterestDue,
      totalPaid: preview.totalSettlement,
      closedAt: closeDate,
      interestPeriods,
    },
  };
  if (recordedBy) document.recordedBy = recordedBy;
  return document;
};

export {
  buildClosureKey,
  buildLoanClosureDocument,
  buildLoanClosurePreview,
  dateKeyInTimeZone,
  parseDateOnly,
  validateCloseDate,
};
