import AuditLog from "../models/auditLogModel.js";
import SavingsPayment from "../models/savingsModel.js";
import SavingsWithdrawal from "../models/savingsWithdrawalModel.js";
import User from "../models/userModel.js";
import {
  computeSavingsSummary,
  roundMoney,
  validateSavingsTimeline,
} from "../services/savingsLedgerService.js";

// ─── Helper: normalize a date to the start of its week (Monday) ───────────────
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toPlainObject = (record) =>
  typeof record?.toObject === "function" ? record.toObject() : record;

const buildSavingsTransactions = (payments, withdrawals) => [
  ...payments.map((payment) => ({
    ...toPlainObject(payment),
    transactionType: "deposit",
    transactionDate: payment.paidOn,
  })),
  ...withdrawals.map((withdrawal) => ({
    ...toPlainObject(withdrawal),
    transactionType: "withdrawal",
    transactionDate: withdrawal.withdrawalDate,
  })),
].sort(
  (left, right) =>
    new Date(right.transactionDate) - new Date(left.transactionDate) ||
    new Date(right.createdAt || 0) - new Date(left.createdAt || 0),
);

const validatePaymentValues = ({ amount, paidOn }) => {
  const parsedAmount = Number(amount);
  const parsedPaidOn = new Date(paidOn);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error("amount must be greater than 0");
  }
  if (!paidOn || Number.isNaN(parsedPaidOn.getTime())) {
    throw new Error("paidOn must be valid");
  }
  return { amount: parsedAmount, paidOn: parsedPaidOn };
};

// ─── ADMIN: Record a weekly savings deposit ──────────────────────────────────
const recordSavingsPayment = async (req, res) => {
  const { userId } = req.params;
  const { amount, paidOn, weekStartDate, note } = req.body;
  let values;
  try {
    values = validatePaymentValues({ amount, paidOn });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }
  const resolvedWeekStart = weekStartDate
    ? getWeekStart(weekStartDate)
    : getWeekStart(values.paidOn);
  if (Number.isNaN(resolvedWeekStart.getTime())) {
    return res.status(400).json({ message: "weekStartDate must be valid" });
  }

  const existing = await SavingsPayment.findOne({
    user: userId,
    weekStartDate: resolvedWeekStart,
  });
  if (existing) {
    return res.status(409).json({
      message: "Savings for this week already recorded. Use update if needed.",
      existing,
    });
  }

  const payment = await SavingsPayment.create({
    user: userId,
    weekStartDate: resolvedWeekStart,
    paidOn: values.paidOn,
    amount: values.amount,
    note,
    recordedBy: req.user._id,
  });
  return res.status(201).json(payment);
};

// ─── ADMIN: Update an existing savings deposit ───────────────────────────────
const updateSavingsPayment = async (req, res) => {
  const { userId, paymentId } = req.params;
  const payment = await SavingsPayment.findOne({ _id: paymentId, user: userId });
  if (!payment) {
    return res.status(404).json({ message: "Savings payment not found" });
  }

  const nextValues = {
    amount: req.body.amount === undefined ? payment.amount : req.body.amount,
    paidOn: req.body.paidOn === undefined ? payment.paidOn : req.body.paidOn,
  };
  let values;
  try {
    values = validatePaymentValues(nextValues);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find({ user: userId }).lean(),
    SavingsWithdrawal.find({ user: userId }).lean(),
  ]);
  const updatedPayments = payments.map((item) =>
    String(item._id) === String(payment._id)
      ? { ...item, ...values }
      : item,
  );
  const validation = validateSavingsTimeline(updatedPayments, withdrawals);
  if (!validation.valid) {
    return res.status(409).json({
      message:
        "This change would make a recorded savings withdrawal exceed the available balance",
    });
  }

  payment.amount = values.amount;
  payment.paidOn = values.paidOn;
  if (req.body.note !== undefined) payment.note = req.body.note;
  payment.recordedBy = req.user._id;
  await payment.save();
  return res.json(payment);
};

// ─── ADMIN: Get one member's complete savings ledger ─────────────────────────
const getUserSavingsDetail = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });

  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find({ user: userId })
      .sort({ paidOn: -1, createdAt: -1 })
      .populate("recordedBy", "name"),
    SavingsWithdrawal.find({ user: userId })
      .sort({ withdrawalDate: -1, createdAt: -1 })
      .populate("recordedBy", "name")
      .populate("updatedBy", "name"),
  ]);
  const summary = computeSavingsSummary(payments, withdrawals);
  const currentWeekStart = getWeekStart(new Date());
  const currentWeekPaid = payments.some(
    (payment) => payment.weekStartDate.getTime() === currentWeekStart.getTime(),
  );

  return res.json({
    user,
    ...summary,
    savingsInterest: roundMoney(summary.totalSavings * 0.01),
    currentWeekPaid,
    payments,
    withdrawals,
    transactions: buildSavingsTransactions(payments, withdrawals),
  });
};

// ─── ADMIN: Overview of all members' net savings ─────────────────────────────
const getAllUsersSavingsOverview = async (req, res) => {
  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find().lean(),
    SavingsWithdrawal.find().lean(),
  ]);
  const userIds = new Set([
    ...payments.map((item) => String(item.user)),
    ...withdrawals.map((item) => String(item.user)),
  ]);
  const users = await User.find({ _id: { $in: [...userIds] } })
    .select("name email")
    .lean();

  const result = users.map((user) => {
    const userPayments = payments.filter(
      (item) => String(item.user) === String(user._id),
    );
    const userWithdrawals = withdrawals.filter(
      (item) => String(item.user) === String(user._id),
    );
    const summary = computeSavingsSummary(userPayments, userWithdrawals);
    const lastPaidOn = userPayments.reduce((latest, item) => {
      const date = new Date(item.paidOn);
      return !latest || date > latest ? date : latest;
    }, null);
    const lastWithdrawalOn = userWithdrawals.reduce((latest, item) => {
      const date = new Date(item.withdrawalDate);
      return !latest || date > latest ? date : latest;
    }, null);
    const lastTransactionOn = [lastPaidOn, lastWithdrawalOn]
      .filter(Boolean)
      .sort((left, right) => right - left)[0] || null;
    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      ...summary,
      paymentsCount: summary.depositCount,
      withdrawalsCount: summary.withdrawalCount,
      savingsInterest: roundMoney(summary.totalSavings * 0.01),
      lastPaidOn,
      lastWithdrawalOn,
      lastTransactionOn,
    };
  });
  result.sort((left, right) => left.name.localeCompare(right.name));
  return res.json(result);
};

// ─── USER: View own net savings summary ──────────────────────────────────────
const getMySavingsSummary = async (req, res) => {
  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find({ user: req.user._id })
      .sort({ paidOn: 1 })
      .select("weekStartDate paidOn amount note createdAt"),
    SavingsWithdrawal.find({ user: req.user._id })
      .sort({ withdrawalDate: 1 })
      .select(
        "withdrawalDate amount reason paymentMethod referenceNumber note createdAt",
      ),
  ]);
  const summary = computeSavingsSummary(payments, withdrawals);
  const currentWeekStart = getWeekStart(new Date());
  const currentWeekPaid = payments.some(
    (payment) => payment.weekStartDate.getTime() === currentWeekStart.getTime(),
  );

  return res.json({
    ...summary,
    currentWeekPaid,
    payments,
    withdrawals,
    transactions: buildSavingsTransactions(payments, withdrawals),
  });
};

// ─── ADMIN: Hard-delete a savings deposit with balance protection ────────────
const deleteSavingsPayment = async (req, res) => {
  const { userId, paymentId } = req.params;
  const { reason = "" } = req.body || {};
  const user = await User.findById(userId).select("name role");
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }
  const payment = await SavingsPayment.findOne({ _id: paymentId, user: userId });
  if (!payment) {
    return res.status(404).json({ message: "Savings payment not found" });
  }

  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find({ user: userId }).lean(),
    SavingsWithdrawal.find({ user: userId }).lean(),
  ]);
  const remainingPayments = payments.filter(
    (item) => String(item._id) !== String(payment._id),
  );
  const validation = validateSavingsTimeline(remainingPayments, withdrawals);
  if (!validation.valid) {
    return res.status(409).json({
      message:
        "This deposit cannot be deleted because a later withdrawal depends on it",
    });
  }

  const before = computeSavingsSummary(payments, withdrawals);
  const after = computeSavingsSummary(remainingPayments, withdrawals);
  await payment.deleteOne();
  const summaryBefore = {
    ...before,
    savingsInterest: roundMoney(before.totalSavings * 0.01),
  };
  const summaryAfter = {
    ...after,
    savingsInterest: roundMoney(after.totalSavings * 0.01),
  };

  try {
    await AuditLog.create({
      adminId: req.user._id,
      adminName: req.user.name || "",
      action: "DELETE_SAVINGS_PAYMENT",
      userId,
      deletedRecordId: paymentId,
      deletedRecord: {
        type: "savings-deposit",
        amount: payment.amount,
        date: payment.paidOn,
        note: payment.note,
      },
      summaryBefore,
      summaryAfter,
      reason,
    });
  } catch (error) {
    console.error("[AuditLog] Failed to write audit log:", error.message);
  }

  return res.json({
    success: true,
    deletedPaymentId: paymentId,
    userId,
    summaryAfter,
  });
};

export {
  buildSavingsTransactions,
  deleteSavingsPayment,
  getAllUsersSavingsOverview,
  getMySavingsSummary,
  getUserSavingsDetail,
  getWeekStart,
  recordSavingsPayment,
  updateSavingsPayment,
};
