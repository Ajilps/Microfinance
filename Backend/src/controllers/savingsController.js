import SavingsPayment from "../models/savingsModel.js";
import User from "../models/userModel.js";
import AuditLog from "../models/auditLogModel.js";

// ─── Helper: normalize a date to the start of its week (Monday) ───────────────
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── ADMIN: Record a weekly savings payment for a user ────────────────────────
// POST /api/admin/savings/:userId/payment
// Body: { amount, paidOn, weekStartDate?, note }
const recordSavingsPayment = async (req, res) => {
  const { userId } = req.params;
  const { amount, paidOn, weekStartDate, note } = req.body;

  if (!amount || !paidOn) {
    return res.status(400).json({ message: "amount and paidOn are required" });
  }

  const user = await User.findById(userId);
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  // If admin doesn't supply a weekStartDate, derive it from paidOn
  const resolvedWeekStart = weekStartDate
    ? getWeekStart(weekStartDate)
    : getWeekStart(paidOn);

  // Prevent duplicate entry for the same week
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
    paidOn: new Date(paidOn),
    amount,
    note,
    recordedBy: req.user._id,
  });

  res.status(201).json(payment);
};

// ─── ADMIN: Update an existing savings payment ────────────────────────────────
// PUT /api/admin/savings/:userId/payment/:paymentId
// Body: { amount, paidOn, note }
const updateSavingsPayment = async (req, res) => {
  const { paymentId } = req.params;
  const { amount, paidOn, note } = req.body;

  const payment = await SavingsPayment.findById(paymentId);
  if (!payment) {
    return res.status(404).json({ message: "Savings payment not found" });
  }

  if (amount !== undefined) payment.amount = amount;
  if (paidOn !== undefined) payment.paidOn = new Date(paidOn);
  if (note !== undefined) payment.note = note;
  payment.recordedBy = req.user._id;

  await payment.save();
  res.json(payment);
};

// ─── ADMIN: Get a specific user's savings history + interest ──────────────────
// GET /api/admin/savings/:userId
const getUserSavingsDetail = async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select("name email");
  if (!user) return res.status(404).json({ message: "User not found" });

  const payments = await SavingsPayment.find({ user: userId })
    .sort({ weekStartDate: 1 })
    .populate("recordedBy", "name");

  const totalSavings = payments.reduce((sum, p) => sum + p.amount, 0);
  const savingsInterest = parseFloat((totalSavings * 0.01).toFixed(2));

  // Check if current week is paid
  const currentWeekStart = getWeekStart(new Date());
  const currentWeekPaid = payments.some(
    (p) => p.weekStartDate.getTime() === currentWeekStart.getTime()
  );

  res.json({
    user,
    totalSavings,
    savingsInterest, // Admin-only field
    currentWeekPaid,
    payments,
  });
};

// ─── ADMIN: Overview of all users' savings ────────────────────────────────────
// GET /api/admin/savings
const getAllUsersSavingsOverview = async (req, res) => {
  const aggregated = await SavingsPayment.aggregate([
    {
      $group: {
        _id: "$user",
        totalSavings: { $sum: "$amount" },
        paymentsCount: { $sum: 1 },
        lastPaidOn: { $max: "$paidOn" },
      },
    },
    {
      $addFields: {
        savingsInterest: {
          $round: [{ $multiply: ["$totalSavings", 0.01] }, 2],
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        userId: "$_id",
        name: "$userInfo.name",
        email: "$userInfo.email",
        totalSavings: 1,
        savingsInterest: 1,
        paymentsCount: 1,
        lastPaidOn: 1,
      },
    },
    { $sort: { name: 1 } },
  ]);

  res.json(aggregated);
};

// ─── USER: View own savings summary (NO interest) ─────────────────────────────
// GET /api/savings/me
const getMySavingsSummary = async (req, res) => {
  const userId = req.user._id;

  const payments = await SavingsPayment.find({ user: userId })
    .sort({ weekStartDate: 1 })
    .select("weekStartDate paidOn amount note");

  const totalSavings = payments.reduce((sum, p) => sum + p.amount, 0);

  const currentWeekStart = getWeekStart(new Date());
  const currentWeekPaid = payments.some(
    (p) => p.weekStartDate.getTime() === currentWeekStart.getTime()
  );

  res.json({
    totalSavings,
    currentWeekPaid,
    payments: payments.map((p) => ({
      weekStartDate: p.weekStartDate,
      paidOn: p.paidOn,
      amount: p.amount,
      note: p.note,
    })),
  });
};

// ─── ADMIN: Hard-delete a savings payment with audit log ──────────────────────
// DELETE /api/admin/savings/:userId/payment/:paymentId
// Body (optional): { reason?: string }
const deleteSavingsPayment = async (req, res) => {
  const { userId, paymentId } = req.params;
  const { reason = "" } = req.body || {};

  // 1. Verify the user exists
  const user = await User.findById(userId).select("name role");
  if (!user || user.role !== "user") {
    return res.status(404).json({ message: "User not found" });
  }

  // 2. Verify the payment exists and belongs to this user
  const payment = await SavingsPayment.findOne({ _id: paymentId, user: userId });
  if (!payment) {
    return res.status(404).json({ message: "Savings payment not found" });
  }

  // 3. Compute totals BEFORE deletion for audit log
  const allPaymentsBefore = await SavingsPayment.find({ user: userId });
  const totalBefore = allPaymentsBefore.reduce((s, p) => s + p.amount, 0);

  // 4. Hard-delete the payment
  await SavingsPayment.deleteOne({ _id: paymentId });

  // 5. Recompute totals from remaining records
  const allPaymentsAfter = await SavingsPayment.find({ user: userId });
  const totalAfter = allPaymentsAfter.reduce((s, p) => s + p.amount, 0);

  const summaryBefore = {
    totalSavings: parseFloat(totalBefore.toFixed(2)),
    savingsInterest: parseFloat((totalBefore * 0.01).toFixed(2)),
    paymentsCount: allPaymentsBefore.length,
  };
  const summaryAfter = {
    totalSavings: parseFloat(totalAfter.toFixed(2)),
    savingsInterest: parseFloat((totalAfter * 0.01).toFixed(2)),
    paymentsCount: allPaymentsAfter.length,
  };

  // 6. Write audit log (non-blocking)
  try {
    await AuditLog.create({
      adminId:   req.user._id,
      adminName: req.user.name || "",
      action:    "DELETE_SAVINGS_PAYMENT",
      userId,
      deletedRecordId: paymentId,
      deletedRecord: {
        type:   "savings",
        amount: payment.amount,
        date:   payment.paidOn,
        note:   payment.note,
      },
      summaryBefore,
      summaryAfter,
      reason,
    });
  } catch (auditErr) {
    console.error("[AuditLog] Failed to write audit log:", auditErr.message);
  }

  return res.json({
    success: true,
    deletedPaymentId: paymentId,
    userId,
    summaryAfter,
  });
};

export {
  recordSavingsPayment,
  updateSavingsPayment,
  getUserSavingsDetail,
  getAllUsersSavingsOverview,
  getMySavingsSummary,
  deleteSavingsPayment,
};
