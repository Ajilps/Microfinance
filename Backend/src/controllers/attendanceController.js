import { Parser } from "json2csv";
import Attendance from "../models/attendanceModel.js";
import FinePayment from "../models/finePaymentModel.js";
import User from "../models/userModel.js";

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Returns the start of the week (normalized to midnight) for a given date.
 * @param {Date} date
 * @param {number} startDay - 0 = Sunday, 1 = Monday (default: 0)
 */
const getWeekStart = (date, startDay = 0) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const ATTENDANCE_CSV_FIELDS = [
  "Name",
  "Email",
  "Total Weeks",
  "Present",
  "Absent",
  "Late",
  "Leave",
  "Fine Owed (INR)",
  "Total Paid (INR)",
  "Balance (INR)",
];

const buildAttendanceSummary = (users, records, finePayments) =>
  users.map((user) => {
    const userId = String(user._id);
    const userRecords = records.filter(
      (record) => record.user && String(record.user._id || record.user) === userId,
    );
    const present = userRecords.filter((record) => record.status === "present").length;
    const absent = userRecords.filter((record) => record.status === "absent").length;
    const late = userRecords.filter((record) => record.status === "late").length;
    const leave = userRecords.filter((record) => record.status === "leave").length;
    const fineOwed = absent * 20;
    const totalPaid = finePayments
      .filter((payment) => String(payment.user?._id || payment.user) === userId)
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      totalWeeks: userRecords.length,
      present,
      absent,
      late,
      leave,
      fineOwed,
      totalPaid,
      balance: fineOwed - totalPaid,
    };
  });

const attendanceSummaryToCsvRows = (summary) =>
  summary.map((row) => ({
    Name: row.name,
    Email: row.email,
    "Total Weeks": row.totalWeeks,
    Present: row.present,
    Absent: row.absent,
    Late: row.late,
    Leave: row.leave,
    "Fine Owed (INR)": row.fineOwed,
    "Total Paid (INR)": row.totalPaid,
    "Balance (INR)": row.balance,
  }));

// ─── Mark Bulk Attendance ─────────────────────────────────────────────────────

// @desc    Admin marks attendance for all users for a given week
// @route   POST /api/admin/attendance
// @access  Private/Admin
// Body: { attendanceDate: "2026-03-16", weekStartDay: 0, records: [{ userId, status, note }] }
const markBulkAttendance = async (req, res) => {
  const { attendanceDate, weekStartDay = 0, records } = req.body;

  if (
    !attendanceDate ||
    !records ||
    !Array.isArray(records) ||
    records.length === 0
  ) {
    return res
      .status(400)
      .json({ message: "attendanceDate and records are required" });
  }

  const adminId = req.user._id;
  const weekStart = getWeekStart(new Date(attendanceDate), weekStartDay);

  const ops = records.map(({ userId, status, note }) => ({
    updateOne: {
      filter: { user: userId, weekStartDate: weekStart },
      update: {
        $set: {
          status,
          note: note || "",
          markedBy: adminId,
          attendanceDate: new Date(attendanceDate),
          weekStartDate: weekStart,
          user: userId,
        },
      },
      upsert: true,
    },
  }));

  await Attendance.bulkWrite(ops);
  res.json({ message: "Attendance marked successfully", weekStart });
};

// ─── Get Attendance by Date ───────────────────────────────────────────────────

// @desc    Get all attendance records for a specific week (by any date within it)
// @route   GET /api/admin/attendance?date=2026-03-16&weekStartDay=0
// @access  Private/Admin
const getAttendanceByDate = async (req, res) => {
  const { date, weekStartDay = 0 } = req.query;

  if (!date) {
    return res.status(400).json({ message: "date query param is required" });
  }

  const weekStart = getWeekStart(new Date(date), parseInt(weekStartDay));

  const records = await Attendance.find({ weekStartDate: weekStart })
    .populate("user", "name email")
    .populate("markedBy", "name");

  res.json({ weekStart, records });
};

// ─── Monthly Attendance Summary ───────────────────────────────────────────────

// @desc    Get monthly attendance summary for all users (present/absent counts)
// @route   GET /api/admin/attendance/monthly?month=3&year=2026
// @access  Private/Admin
const getMonthlyAttendanceSummary = async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res
      .status(400)
      .json({ message: "month and year query params are required" });
  }

  const m = parseInt(month);
  const y = parseInt(year);

  // Date range: first to last day of the month
  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

  // Fetch all attendance records in this month
  const records = await Attendance.find({
    attendanceDate: { $gte: startOfMonth, $lte: endOfMonth },
  }).populate("user", "name email");

  // Fetch all users (role: user)
  const users = await User.find({ role: "user" });

  // Fetch all fine payments for this month
  const finePayments = await FinePayment.find({ month: m, year: y });

  const summary = buildAttendanceSummary(users, records, finePayments);

  res.json({ month: m, year: y, summary });
};
// @desc    Get all attendance summary for all users (present/absent counts)
// @route   GET /api/admin/attendance/all
// @access  Private/Admin
//Total absent, fine and total fine paid ─────────────────────────────────────────────────────
const getAllTimeAttendanceSummary = async (req, res) => {
  const now = new Date();

  // Fetch attendance recorded through now.
  const records = await Attendance.find({
    attendanceDate: { $lte: now },
  }).populate("user", "name email");

  // Fetch all users (role: user)
  const users = await User.find({ role: "user" }).sort({ email: 1 });

  // Fetch fine payments recorded through now.
  const finePayments = await FinePayment.find({ paidOn: { $lte: now } });

  const summary = buildAttendanceSummary(users, records, finePayments);

  res.json({ summary });
};

// ─── Download Monthly CSV ─────────────────────────────────────────────────────

// @desc    Download monthly attendance + fine summary as CSV
// @route   GET /api/admin/attendance/download?month=3&year=2026
// @access  Private/Admin
const downloadMonthlyCSV = async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year) {
    return res
      .status(400)
      .json({ message: "month and year query params are required" });
  }

  const m = parseInt(month);
  const y = parseInt(year);

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

  const records = await Attendance.find({
    attendanceDate: { $gte: startOfMonth, $lte: endOfMonth },
  }).populate("user", "name email");

  const users = await User.find({ role: "user" });
  const finePayments = await FinePayment.find({ month: m, year: y });

  const monthName = new Date(y, m - 1, 1).toLocaleString("default", {
    month: "long",
  });

  const rows = users.map((user) => {
    const userRecords = records.filter(
      (r) => r.user && r.user._id.toString() === user._id.toString(),
    );

    const present = userRecords.filter((r) => r.status === "present").length;
    const absent = userRecords.filter((r) => r.status === "absent").length;
    const late = userRecords.filter((r) => r.status === "late").length;
    const leave = userRecords.filter((r) => r.status === "leave").length;
    const fineOwed = absent * 20;

    const totalPaid = finePayments
      .filter((p) => p.user.toString() === user._id.toString())
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      Name: user.name,
      Email: user.email,
      "Total Weeks": userRecords.length,
      Present: present,
      Absent: absent,
      Late: late,
      Leave: leave,
      "Fine Owed (₹)": fineOwed,
      "Total Paid (₹)": totalPaid,
      "Balance (₹)": fineOwed - totalPaid,
    };
  });

  const fields = [
    "Name",
    "Email",
    "Total Weeks",
    "Present",
    "Absent",
    "Late",
    "Leave",
    "Fine Owed (₹)",
    "Total Paid (₹)",
    "Balance (₹)",
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="attendance-${monthName.toLowerCase()}-${y}.csv"`,
  );
  res.send(csv);
};

// @desc    Download all-time attendance + fine summary as CSV
// @route   GET /api/admin/attendance/download/all
// @access  Private/Admin
const downloadAllTimeCSV = async (req, res) => {
  const now = new Date();
  const [records, users, finePayments] = await Promise.all([
    Attendance.find({ attendanceDate: { $lte: now } }).populate(
      "user",
      "name email",
    ),
    User.find({ role: "user" }).sort({ name: 1 }),
    FinePayment.find({ paidOn: { $lte: now } }),
  ]);
  const summary = buildAttendanceSummary(users, records, finePayments);
  const csv = new Parser({ fields: ATTENDANCE_CSV_FIELDS }).parse(
    attendanceSummaryToCsvRows(summary),
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="attendance-all-time.csv"',
  );
  res.send(csv);
};

// ─── Record Fine Payment ──────────────────────────────────────────────────────

// @desc    Admin records a fine payment made by a user
// @route   POST /api/admin/attendance/fine/payment
// @access  Private/Admin
// Body: { userId, amount, month, year, paidOn, note }
const recordFinePayment = async (req, res) => {
  const { userId, amount, month, year, paidOn, note } = req.body;

  if (!userId || !amount || !month || !year) {
    return res
      .status(400)
      .json({ message: "userId, amount, month, and year are required" });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const payment = await FinePayment.create({
    user: userId,
    amount,
    month: parseInt(month),
    year: parseInt(year),
    paidOn: paidOn ? new Date(paidOn) : new Date(),
    recordedBy: req.user._id,
    note,
  });

  res.status(201).json({ message: "Fine payment recorded", payment });
};

// ─── Get Fine Report for a User ───────────────────────────────────────────────

// @desc    Get fine owed, total paid, and balance for a specific user in a month
// @route   GET /api/admin/attendance/fine/:userId?month=3&year=2026
// @access  Private/Admin
const getUserFineReport = async (req, res) => {
  const { userId } = req.params;
  const { month, year } = req.query;

  if (!month || !year) {
    return res
      .status(400)
      .json({ message: "month and year query params are required" });
  }

  const m = parseInt(month);
  const y = parseInt(year);

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

  const records = await Attendance.find({
    user: userId,
    attendanceDate: { $gte: startOfMonth, $lte: endOfMonth },
  });

  const absent = records.filter((r) => r.status === "absent").length;
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const leave = records.filter((r) => r.status === "leave").length;
  const fineOwed = absent * 20;

  const payments = await FinePayment.find({ user: userId, month: m, year: y });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    userId,
    name: user.name,
    email: user.email,
    month: m,
    year: y,
    totalWeeks: records.length,
    present,
    absent,
    late,
    leave,
    fineOwed,
    totalPaid,
    balance: fineOwed - totalPaid,
    payments,
  });
};

// ─── Get Own Attendance Summary (User) ───────────────────────────────────────

// @desc    Logged-in user views their own attendance + fine summary for a month
// @route   GET /api/users/attendance/me?month=3&year=2026
// @access  Private (user)
const getMyAttendanceSummary = async (req, res) => {
  const userId = req.user._id;
  const { month, year } = req.query;

  if (!month || !year) {
    return res
      .status(400)
      .json({ message: "month and year query params are required" });
  }

  const m = parseInt(month);
  const y = parseInt(year);

  const startOfMonth = new Date(y, m - 1, 1);
  const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

  // Fetch this user's attendance records for the month
  const records = await Attendance.find({
    user: userId,
    attendanceDate: { $gte: startOfMonth, $lte: endOfMonth },
  }).sort({ attendanceDate: 1 });

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const leave = records.filter((r) => r.status === "leave").length;
  const fineOwed = absent * 20;

  // Fetch fine payments made by this user for the month
  const payments = await FinePayment.find({
    user: userId,
    month: m,
    year: y,
  }).select("amount paidOn note");
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  res.json({
    month: m,
    year: y,
    totalWeeks: records.length,
    present,
    absent,
    late,
    leave,
    fineOwed,
    totalPaid,
    fineBalance: fineOwed - totalPaid,
    finePayments: payments.map((p) => ({
      amount: p.amount,
      paidOn: p.paidOn,
      note: p.note,
    })),
    weeklyRecords: records.map((r) => ({
      weekStartDate: r.weekStartDate,
      attendanceDate: r.attendanceDate,
      status: r.status,
      note: r.note,
    })),
  });
};

export {
  markBulkAttendance,
  getAttendanceByDate,
  getMonthlyAttendanceSummary,
  getAllTimeAttendanceSummary,
  downloadMonthlyCSV,
  downloadAllTimeCSV,
  recordFinePayment,
  getUserFineReport,
  getMyAttendanceSummary,
  buildAttendanceSummary,
};
