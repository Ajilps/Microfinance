import LoanTransaction from "../models/loanModel.js";
import {
  calculateInterestPeriods,
  computeLoanSummary,
} from "./loanLedgerService.js";

const DEFAULT_BATCH_SIZE = 500;

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const userIdFor = (transaction) =>
  String(transaction.user?._id || transaction.user);

const groupLoanTransactions = (transactions) => {
  const grouped = new Map();
  for (const transaction of transactions) {
    const userId = userIdFor(transaction);
    if (!userId || userId === "undefined") continue;
    if (!grouped.has(userId)) grouped.set(userId, []);
    grouped.get(userId).push(transaction);
  }
  for (const ledger of grouped.values()) {
    ledger.sort(
      (left, right) =>
        new Date(left.date) - new Date(right.date) ||
        new Date(left.createdAt || 0) - new Date(right.createdAt || 0),
    );
  }
  return grouped;
};

const buildInterestDocument = ({
  userId,
  period,
  source = "automatic",
  recordedBy,
}) => {
  const prefix = source === "automatic" ? "Automatic interest" : "Interest";
  const recordedAt = new Date();
  const document = {
    user: userId,
    type: "interest",
    amount: period.interestAmount,
    // The accounting date is when the 28-day period became fully due.
    date: period.periodEnd,
    entrySource: source,
    note: `${prefix}: 1% of ₹${period.principalBalance.toFixed(2)} for ${period.periodStart.toLocaleDateString("en-IN")} – ${period.periodEnd.toLocaleDateString("en-IN")}`,
    interestPeriod: {
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      principalBalance: period.principalBalance,
      interestRate: period.interestRate,
    },
    createdAt: recordedAt,
    updatedAt: recordedAt,
  };
  if (recordedBy) document.recordedBy = recordedBy;
  return document;
};

/**
 * Pure planning step. A repeated call with the same ledger returns the same
 * due periods; once its generated documents are part of the ledger it returns
 * no entries for those period starts.
 */
const collectDueInterestEntries = (
  transactions,
  toDate = new Date(),
  options = {},
) => {
  const grouped = groupLoanTransactions(transactions);
  const entries = [];

  for (const [userId, ledger] of grouped.entries()) {
    const periods = calculateInterestPeriods(ledger, toDate).filter(
      (period) => !period.alreadyRecorded && !period.isPartial,
    );
    for (const period of periods) {
      entries.push({
        userId,
        period,
        document: buildInterestDocument({ userId, period, ...options }),
      });
    }
  }
  return entries;
};

const buildInterestUpsertOperation = (entry) => ({
  updateOne: {
    filter: {
      user: entry.document.user,
      type: "interest",
      "interestPeriod.periodStart": entry.document.interestPeriod.periodStart,
    },
    update: { $setOnInsert: entry.document },
    upsert: true,
    timestamps: false,
  },
});

const persistInterestEntries = async (
  entries,
  { loanModel = LoanTransaction, batchSize = DEFAULT_BATCH_SIZE } = {},
) => {
  let periodsApplied = 0;
  let totalApplied = 0;

  for (let offset = 0; offset < entries.length; offset += batchSize) {
    const batch = entries.slice(offset, offset + batchSize);
    const result = await loanModel.bulkWrite(
      batch.map(buildInterestUpsertOperation),
      { ordered: false },
    );
    const upsertedIndexes = Object.keys(result.upsertedIds || {}).map(Number);
    const appliedEntries = upsertedIndexes.length
      ? upsertedIndexes.map((index) => batch[index]).filter(Boolean)
      : result.upsertedCount === batch.length
        ? batch
        : [];

    periodsApplied += Number(result.upsertedCount || appliedEntries.length);
    totalApplied += appliedEntries.reduce(
      (sum, entry) => sum + entry.period.interestAmount,
      0,
    );
  }

  return {
    periodsApplied,
    totalApplied: roundMoney(totalApplied),
  };
};

const applyDueInterestForUser = async ({
  userId,
  toDate = new Date(),
  source = "manual",
  recordedBy,
  loanModel = LoanTransaction,
}) => {
  const transactions = await loanModel.find({ user: userId }).sort({
    date: 1,
    createdAt: 1,
  });
  const dueEntries = collectDueInterestEntries(transactions, toDate, {
    source,
    recordedBy,
  });
  const persisted = await persistInterestEntries(dueEntries, { loanModel });
  const updatedTransactions = persisted.periodsApplied
    ? await loanModel.find({ user: userId }).sort({ date: 1, createdAt: 1 })
    : transactions;

  return {
    transactionsFound: transactions.length,
    duePeriodsFound: dueEntries.length,
    ...persisted,
    summary: computeLoanSummary(updatedTransactions),
  };
};

const applyDueInterestForAllUsers = async ({
  toDate = new Date(),
  loanModel = LoanTransaction,
} = {}) => {
  // One batched ledger query replaces the previous one-query-per-member scan.
  const transactions = await loanModel
    .find()
    .select(
      "user type amount paymentTarget date createdAt interestPeriod closureDetails",
    )
    .sort({ user: 1, date: 1, createdAt: 1 })
    .lean();
  const usersScanned = groupLoanTransactions(transactions).size;
  const dueEntries = collectDueInterestEntries(transactions, toDate, {
    source: "automatic",
  });
  const persisted = await persistInterestEntries(dueEntries, { loanModel });

  return {
    usersScanned,
    transactionsScanned: transactions.length,
    duePeriodsFound: dueEntries.length,
    ...persisted,
  };
};

export {
  applyDueInterestForAllUsers,
  applyDueInterestForUser,
  buildInterestDocument,
  buildInterestUpsertOperation,
  collectDueInterestEntries,
  groupLoanTransactions,
  persistInterestEntries,
};
