import ExtraTransaction from "../models/extraTransactionModel.js";
import { DATE_ONLY_PATTERN } from "../config/constants.js";
import FinePayment from "../models/finePaymentModel.js";
import LoanTransaction from "../models/loanModel.js";
import SavingsPayment from "../models/savingsModel.js";
import SavingsWithdrawal from "../models/savingsWithdrawalModel.js";

const parseDateInput = (value, fieldName) => {
  if (!value || typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return date;
};

const getWeekRange = (dateValue) => {
  const selectedDate = parseDateInput(dateValue, "date");
  const day = selectedDate.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const weekStart = new Date(selectedDate);
  weekStart.setUTCDate(selectedDate.getUTCDate() - daysSinceMonday);

  const weekEndExclusive = new Date(weekStart);
  weekEndExclusive.setUTCDate(weekStart.getUTCDate() + 7);

  const weekEnd = new Date(weekEndExclusive.getTime() - 1);
  return { weekStart, weekEnd, weekEndExclusive };
};

const validateExtraTransaction = (body) => {
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const amount = Number(body.amount);
  const sourceOrReason =
    typeof body.sourceOrReason === "string" ? body.sourceOrReason.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!["income", "expense"].includes(type)) {
    throw new Error("type must be 'income' or 'expense'");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than 0");
  }
  if (!sourceOrReason) {
    throw new Error("Money source or reason is required");
  }
  if (sourceOrReason.length > 200) {
    throw new Error("Money source or reason cannot exceed 200 characters");
  }
  if (note.length > 1000) {
    throw new Error("Note cannot exceed 1000 characters");
  }

  return {
    type,
    amount,
    transactionDate: parseDateInput(body.transactionDate, "transactionDate"),
    sourceOrReason,
    note,
  };
};

const getExtraTransactionTotals = (entries) => {
  const income = entries
    .filter((entry) => entry.type === "income")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const expense = entries
    .filter((entry) => entry.type === "expense")
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    balance: Number((income - expense).toFixed(2)),
  };
};

const buildWeeklyTransactions = ({
  loans,
  savings,
  savingsWithdrawals = [],
  finePayments,
  extras,
}) => {
  const transactions = [];

  for (const transaction of loans) {
    const userName = transaction.user?.name || "Unknown member";
    const recordedBy = transaction.recordedBy?.name || "System";
    const base = {
      id: String(transaction._id),
      sourceType: "loan",
      date: transaction.date,
      memberOrSource: userName,
      reason: transaction.note || "",
      recordedBy,
      income: 0,
      expense: 0,
      nonCash: 0,
      isCash: true,
    };

    if (transaction.type === "loan") {
      transactions.push({
        ...base,
        category: "Loan disbursement",
        expense: transaction.amount,
      });
    } else if (transaction.type === "repayment") {
      transactions.push({
        ...base,
        category:
          transaction.paymentTarget === "interest"
            ? "Interest repayment"
            : "Loan repayment",
        income: transaction.amount,
      });
    } else if (transaction.type === "closure") {
      transactions.push({
        ...base,
        category: "Loan closure payment",
        income: transaction.amount,
      });
    } else if (transaction.type === "interest") {
      transactions.push({
        ...base,
        category: "Interest accrued",
        isCash: false,
        nonCash: transaction.amount,
      });
    } else if (transaction.type === "fine") {
      transactions.push({
        ...base,
        category: "Loan fine accrued",
        isCash: false,
        nonCash: transaction.amount,
      });
    }
  }

  for (const payment of savings) {
    transactions.push({
      id: String(payment._id),
      sourceType: "savings",
      date: payment.paidOn,
      category: "Savings deposit",
      memberOrSource: payment.user?.name || "Unknown member",
      reason: payment.note || "",
      recordedBy: payment.recordedBy?.name || "Unknown admin",
      income: payment.amount,
      expense: 0,
      nonCash: 0,
      isCash: true,
    });
  }

  for (const withdrawal of savingsWithdrawals) {
    transactions.push({
      id: String(withdrawal._id),
      sourceType: "savings-withdrawal",
      date: withdrawal.withdrawalDate,
      category: "Savings withdrawal",
      memberOrSource: withdrawal.user?.name || "Unknown member",
      reason: withdrawal.reason || withdrawal.note || "",
      recordedBy: withdrawal.recordedBy?.name || "Unknown admin",
      income: 0,
      expense: withdrawal.amount,
      nonCash: 0,
      isCash: true,
    });
  }

  for (const payment of finePayments) {
    transactions.push({
      id: String(payment._id),
      sourceType: "fine-payment",
      date: payment.paidOn,
      category: "Attendance fine payment",
      memberOrSource: payment.user?.name || "Unknown member",
      reason: payment.note || "",
      recordedBy: payment.recordedBy?.name || "Unknown admin",
      income: payment.amount,
      expense: 0,
      nonCash: 0,
      isCash: true,
    });
  }

  for (const entry of extras) {
    transactions.push({
      id: String(entry._id),
      sourceType: "extra",
      date: entry.transactionDate,
      category: entry.type === "income" ? "Other income" : "Other expense",
      memberOrSource: entry.sourceOrReason,
      reason: entry.note || "",
      recordedBy: entry.recordedBy?.name || "Unknown admin",
      income: entry.type === "income" ? entry.amount : 0,
      expense: entry.type === "expense" ? entry.amount : 0,
      nonCash: 0,
      isCash: true,
    });
  }

  transactions.sort((a, b) => {
    const dateDifference = new Date(b.date) - new Date(a.date);
    return dateDifference || a.category.localeCompare(b.category);
  });

  const categoryTotals = {};
  for (const transaction of transactions) {
    if (!categoryTotals[transaction.category]) {
      categoryTotals[transaction.category] = {
        income: 0,
        expense: 0,
        nonCash: 0,
        total: 0,
      };
    }
    const category = categoryTotals[transaction.category];
    category.income += transaction.income;
    category.expense += transaction.expense;
    category.nonCash += transaction.nonCash;
    category.total +=
      transaction.income + transaction.expense + transaction.nonCash;
  }

  for (const category of Object.values(categoryTotals)) {
    for (const key of Object.keys(category)) {
      category[key] = Number(category[key].toFixed(2));
    }
  }

  const cashIncome = transactions.reduce((sum, item) => sum + item.income, 0);
  const cashExpense = transactions.reduce((sum, item) => sum + item.expense, 0);
  const nonCashCharges = transactions.reduce(
    (sum, item) => sum + item.nonCash,
    0,
  );

  return {
    transactions,
    totals: {
      cashIncome: Number(cashIncome.toFixed(2)),
      cashExpense: Number(cashExpense.toFixed(2)),
      nonCashCharges: Number(nonCashCharges.toFixed(2)),
      transactionCount: transactions.length,
    },
    categoryTotals,
  };
};

const createExtraTransaction = async (req, res) => {
  let values;
  try {
    values = validateExtraTransaction(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const entry = await ExtraTransaction.create({
    ...values,
    recordedBy: req.user._id,
  });
  await entry.populate("recordedBy", "name");
  return res.status(201).json(entry);
};

const updateExtraTransaction = async (req, res) => {
  let values;
  try {
    values = validateExtraTransaction(req.body);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const entry = await ExtraTransaction.findById(req.params.id);
  if (!entry) {
    return res.status(404).json({ message: "Income or expense record not found" });
  }

  Object.assign(entry, values, { updatedBy: req.user._id });
  await entry.save();
  await entry.populate([
    { path: "recordedBy", select: "name" },
    { path: "updatedBy", select: "name" },
  ]);
  return res.json(entry);
};

const getExtraTransactions = async (req, res) => {
  const { type = "all", startDate, endDate } = req.query;
  if (!["all", "income", "expense"].includes(type)) {
    return res.status(400).json({ message: "Invalid transaction type filter" });
  }

  const filter = {};
  if (type !== "all") filter.type = type;

  try {
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) {
        filter.transactionDate.$gte = parseDateInput(startDate, "startDate");
      }
      if (endDate) {
        const endExclusive = parseDateInput(endDate, "endDate");
        endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
        filter.transactionDate.$lt = endExclusive;
      }
      if (
        filter.transactionDate.$gte &&
        filter.transactionDate.$lt &&
        filter.transactionDate.$gte >= filter.transactionDate.$lt
      ) {
        return res.status(400).json({
          message: "startDate must be on or before endDate",
        });
      }
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const entries = await ExtraTransaction.find(filter)
    .sort({ transactionDate: -1, createdAt: -1 })
    .populate("recordedBy", "name")
    .populate("updatedBy", "name");

  return res.json({ entries, totals: getExtraTransactionTotals(entries) });
};

const getWeeklyTransactions = async (req, res) => {
  let range;
  try {
    range = getWeekRange(req.query.date);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const { weekStart, weekEnd, weekEndExclusive } = range;
  const dateFilter = { $gte: weekStart, $lt: weekEndExclusive };

  const [loans, savings, savingsWithdrawals, finePayments, extras] =
    await Promise.all([
    LoanTransaction.find({ date: dateFilter })
      .populate("user", "name email")
      .populate("recordedBy", "name"),
    SavingsPayment.find({ paidOn: dateFilter })
      .populate("user", "name email")
      .populate("recordedBy", "name"),
    SavingsWithdrawal.find({ withdrawalDate: dateFilter })
      .populate("user", "name email")
      .populate("recordedBy", "name"),
    FinePayment.find({ paidOn: dateFilter })
      .populate("user", "name email")
      .populate("recordedBy", "name"),
    ExtraTransaction.find({ transactionDate: dateFilter }).populate(
      "recordedBy",
      "name",
    ),
  ]);

  const report = buildWeeklyTransactions({
    loans,
    savings,
    savingsWithdrawals,
    finePayments,
    extras,
  });

  return res.json({
    weekStart,
    weekEnd,
    ...report,
  });
};

export {
  buildWeeklyTransactions,
  createExtraTransaction,
  getExtraTransactions,
  getExtraTransactionTotals,
  getWeekRange,
  getWeeklyTransactions,
  updateExtraTransaction,
  validateExtraTransaction,
};
