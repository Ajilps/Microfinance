import AuditLog from "../models/auditLogModel.js";
import {
  DATE_ONLY_PATTERN,
  DEFAULT_TIME_ZONE,
  SAVINGS_INTEREST_RATE,
} from "../config/constants.js";
import SavingsPayment from "../models/savingsModel.js";
import SavingsWithdrawal from "../models/savingsWithdrawalModel.js";
import User from "../models/userModel.js";
import {
  computeSavingsSummary,
  validateSavingsTimeline,
} from "../services/savingsLedgerService.js";

const todayInIndia = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const parseDateOnly = (value, fieldName = "withdrawalDate") => {
  if (typeof value !== "string" || !DATE_ONLY_PATTERN.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  if (value > todayInIndia()) {
    throw new Error(`${fieldName} cannot be in the future`);
  }
  return date;
};

const validateWithdrawalInput = (body) => {
  const amount = Number(body.amount);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const paymentMethod =
    typeof body.paymentMethod === "string" ? body.paymentMethod.trim() : "cash";
  const referenceNumber =
    typeof body.referenceNumber === "string" ? body.referenceNumber.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than 0");
  }
  if (!reason) throw new Error("reason is required");
  if (reason.length > 300) throw new Error("reason cannot exceed 300 characters");
  if (!["cash", "bank", "other"].includes(paymentMethod)) {
    throw new Error("paymentMethod must be cash, bank, or other");
  }
  if (referenceNumber.length > 100) {
    throw new Error("referenceNumber cannot exceed 100 characters");
  }
  if (note.length > 1000) throw new Error("note cannot exceed 1000 characters");

  return {
    amount,
    withdrawalDate: parseDateOnly(body.withdrawalDate),
    reason,
    paymentMethod,
    referenceNumber,
    note,
  };
};

const loadSavingsLedger = async (userId) => {
  const [payments, withdrawals] = await Promise.all([
    SavingsPayment.find({ user: userId }).lean(),
    SavingsWithdrawal.find({ user: userId }).lean(),
  ]);
  return { payments, withdrawals };
};

const recordSavingsWithdrawal = async (req, res) => {
  const user = await User.findOne({ _id: req.params.userId, role: "user" });
  if (!user) return res.status(404).json({ message: "User not found" });

  let values;
  try {
    values = validateWithdrawalInput(req.body || {});
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  const { payments, withdrawals } = await loadSavingsLedger(req.params.userId);
  const validation = validateSavingsTimeline(payments, [
    ...withdrawals,
    { ...values, _id: "new-withdrawal", createdAt: new Date() },
  ]);
  if (!validation.valid) {
    return res.status(400).json({
      message: `Withdrawal exceeds the available savings of ₹${validation.balanceBefore.toFixed(2)} on that date`,
    });
  }

  const withdrawal = await SavingsWithdrawal.create({
    user: req.params.userId,
    ...values,
    recordedBy: req.user._id,
  });
  await withdrawal.populate("recordedBy", "name");
  const summary = computeSavingsSummary(payments, [...withdrawals, withdrawal]);
  return res.status(201).json({
    withdrawal,
    summary: {
      ...summary,
      savingsInterest: Number(
        (summary.totalSavings * SAVINGS_INTEREST_RATE).toFixed(2),
      ),
    },
  });
};

const updateSavingsWithdrawal = async (req, res) => {
  const withdrawal = await SavingsWithdrawal.findOne({
    _id: req.params.withdrawalId,
    user: req.params.userId,
  });
  if (!withdrawal) {
    return res.status(404).json({ message: "Savings withdrawal not found" });
  }

  let values;
  try {
    values = validateWithdrawalInput(req.body || {});
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
  const { payments, withdrawals } = await loadSavingsLedger(req.params.userId);
  const updatedWithdrawals = withdrawals.map((item) =>
    String(item._id) === String(withdrawal._id)
      ? { ...item, ...values }
      : item,
  );
  const validation = validateSavingsTimeline(payments, updatedWithdrawals);
  if (!validation.valid) {
    return res.status(400).json({
      message: `Withdrawal exceeds the available savings of ₹${validation.balanceBefore.toFixed(2)} on that date`,
    });
  }

  Object.assign(withdrawal, values, { updatedBy: req.user._id });
  await withdrawal.save();
  await withdrawal.populate([
    { path: "recordedBy", select: "name" },
    { path: "updatedBy", select: "name" },
  ]);
  const summary = computeSavingsSummary(payments, updatedWithdrawals);
  return res.json({
    withdrawal,
    summary: {
      ...summary,
      savingsInterest: Number(
        (summary.totalSavings * SAVINGS_INTEREST_RATE).toFixed(2),
      ),
    },
  });
};

const deleteSavingsWithdrawal = async (req, res) => {
  const withdrawal = await SavingsWithdrawal.findOne({
    _id: req.params.withdrawalId,
    user: req.params.userId,
  });
  if (!withdrawal) {
    return res.status(404).json({ message: "Savings withdrawal not found" });
  }
  const { payments, withdrawals } = await loadSavingsLedger(req.params.userId);
  const remaining = withdrawals.filter(
    (item) => String(item._id) !== String(withdrawal._id),
  );
  const summaryBefore = computeSavingsSummary(payments, withdrawals);
  const summaryAfter = computeSavingsSummary(payments, remaining);
  summaryBefore.savingsInterest = Number(
    (summaryBefore.totalSavings * SAVINGS_INTEREST_RATE).toFixed(2),
  );
  summaryAfter.savingsInterest = Number(
    (summaryAfter.totalSavings * SAVINGS_INTEREST_RATE).toFixed(2),
  );
  await withdrawal.deleteOne();

  try {
    await AuditLog.create({
      adminId: req.user._id,
      adminName: req.user.name || "",
      action: "DELETE_SAVINGS_WITHDRAWAL",
      userId: req.params.userId,
      deletedRecordId: withdrawal._id,
      deletedRecord: {
        type: "savings-withdrawal",
        amount: withdrawal.amount,
        date: withdrawal.withdrawalDate,
        reason: withdrawal.reason,
        paymentMethod: withdrawal.paymentMethod,
        referenceNumber: withdrawal.referenceNumber,
        note: withdrawal.note,
      },
      summaryBefore,
      summaryAfter,
      reason: typeof req.body?.reason === "string" ? req.body.reason.trim() : "",
    });
  } catch (error) {
    console.error("[AuditLog] Failed to write audit log:", error.message);
  }

  return res.json({
    success: true,
    deletedWithdrawalId: withdrawal._id,
    summaryAfter,
  });
};

export {
  deleteSavingsWithdrawal,
  parseDateOnly,
  recordSavingsWithdrawal,
  updateSavingsWithdrawal,
  validateWithdrawalInput,
};
