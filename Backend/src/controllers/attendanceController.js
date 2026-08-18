import { Parser } from "json2csv";
import {
  ATTENDANCE_CSV_FIELDS,
  ATTENDANCE_FINE_AMOUNT,
  ATTENDANCE_WEEK_START_DAY,
} from "../config/constants.js";
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

// Attendance is weekly throughout the application. Keeping the boundary on the
// server prevents different admin screens from producing different uniqueness
// keys for the same meeting date.
const getWeekRange = (date) => {
  const start = getWeekStart(date, ATTENDANCE_WEEK_START_DAY);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
};

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
    const fineOwed = absent * ATTENDANCE_FINE_AMOUNT;
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

const calculateFineTotals = (absentCount, payments) => {
  const fineOwed = Number(absentCount || 0) * ATTENDANCE_FINE_AMOUNT;
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  return { fineOwed, totalPaid, fineBalance: fineOwed - totalPaid };
};

// ─── Mark Bulk Attendance ─────────────────────────────────────────────────────

// @desc    Admin marks attendance for all users for a given week
// @route   POST /api/admin/attendance
// @access  Private/Admin
// Body: { attendanceDate: "2026-03-16", records: [{ userId, status, note }] }
const markBulkAttendance = async (req, res) => {
  const { attendanceDate, records } = req.body;

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

  const parsedAttendanceDate = new Date(attendanceDate);
  if (Number.isNaN(parsedAttendanceDate.getTime())) {
    return res.status(400).json({ message: "attendanceDate must be a valid date" });
  }

  const validStatuses = new Set(["present", "absent", "late", "leave"]);
  const userIds = records.map((record) => String(record.userId || ""));
  if (
    userIds.some((userId) => !userId) ||
    new Set(userIds).size !== userIds.length ||
    records.some((record) => !validStatuses.has(record.status))
  ) {
    return res.status(400).json({
      message: "Each record needs a unique userId and a valid attendance status",
    });
  }

  const adminId = req.user._id;
  const { start: weekStart, end: weekEnd } = getWeekRange(parsedAttendanceDate);

  // Include records written by older clients that used a Sunday week boundary.
  // Updating one of those records migrates it to the canonical Monday boundary
  // instead of inserting a second record for the same member and meeting week.
  const existingRecords = await Attendance.find({
    user: { $in: userIds },
    $or: [
      { weekStartDate: weekStart },
      { attendanceDate: { $gte: weekStart, $lt: weekEnd } },
    ],
  }).select("_id user weekStartDate updatedAt");

  const existingByUser = new Map();
  for (const existingRecord of existingRecords) {
    const userId = String(existingRecord.user);
    const candidates = existingByUser.get(userId) || [];
    candidates.push(existingRecord);
    existingByUser.set(userId, candidates);
  }

  const duplicateIds = [];
  const ops = records.map(({ userId, status, note }) => {
    const candidates = existingByUser.get(String(userId)) || [];
    const canonicalRecord = candidates.find(
      (record) => record.weekStartDate?.getTime() === weekStart.getTime(),
    );
    const recordToUpdate = canonicalRecord || candidates[0];

    duplicateIds.push(
      ...candidates
        .filter((record) => !recordToUpdate || String(record._id) !== String(recordToUpdate._id))
        .map((record) => record._id),
    );

    return {
      updateOne: {
        filter: recordToUpdate
          ? { _id: recordToUpdate._id }
          : { user: userId, weekStartDate: weekStart },
        update: {
          $set: {
            status,
            note: note || "",
            markedBy: adminId,
            attendanceDate: parsedAttendanceDate,
            weekStartDate: weekStart,
            user: userId,
          },
        },
        upsert: !recordToUpdate,
      },
    };
  });

  try {
    await Attendance.bulkWrite(ops, { ordered: false });
  } catch (error) {
    if (error?.code !== 11000) throw error;

    // A second admin may save the same week between the lookup and the upsert.
    // The unique index prevents the duplicate; this retry applies this request
    // to the record that won that race.
    await Attendance.bulkWrite(
      records.map(({ userId, status, note }) => ({
        updateOne: {
          filter: { user: userId, weekStartDate: weekStart },
          update: {
            $set: {
              status,
              note: note || "",
              markedBy: adminId,
              attendanceDate: parsedAttendanceDate,
            },
          },
        },
      })),
      { ordered: false },
    );
  }
  if (duplicateIds.length > 0) {
    await Attendance.deleteMany({ _id: { $in: duplicateIds } });
  }
  res.json({ message: "Attendance marked successfully", weekStart });
};

// ─── Get Attendance by Date ───────────────────────────────────────────────────

// @desc    Get all attendance records for a specific week (by any date within it)
// @route   GET /api/admin/attendance?date=2026-03-16
// @access  Private/Admin
const getAttendanceByDate = async (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ message: "date query param is required" });
  }

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "date must be a valid date" });
  }

  const { start: weekStart, end: weekEnd } = getWeekRange(parsedDate);

  const foundRecords = await Attendance.find({
    $or: [
      { weekStartDate: weekStart },
      { attendanceDate: { $gte: weekStart, $lt: weekEnd } },
    ],
  })
    .populate("user", "name email")
    .populate("markedBy", "name");

  // Do not show a member twice if historical data contains both Sunday- and
  // Monday-based records. Saving this week will also remove the stale copy.
  const recordsByUser = new Map();
  for (const record of foundRecords) {
    const userId = String(record.user?._id || record.user);
    const current = recordsByUser.get(userId);
    const isCanonical = record.weekStartDate?.getTime() === weekStart.getTime();
    const currentIsCanonical = current?.weekStartDate?.getTime() === weekStart.getTime();
    if (!current || (isCanonical && !currentIsCanonical)) {
      recordsByUser.set(userId, record);
    }
  }

  const records = [...recordsByUser.values()];

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
    const fineOwed = absent * ATTENDANCE_FINE_AMOUNT;

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
  const fineOwed = absent * ATTENDANCE_FINE_AMOUNT;

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

  const now = new Date();
  const [records, payments, allTimeAbsentCount, allTimePayments] = await Promise.all([
    Attendance.find({
      user: userId,
      attendanceDate: { $gte: startOfMonth, $lte: endOfMonth },
    }).sort({ attendanceDate: 1 }),
    FinePayment.find({
      user: userId,
      month: m,
      year: y,
    }).select("amount paidOn note"),
    Attendance.countDocuments({
      user: userId,
      status: "absent",
      attendanceDate: { $lte: now },
    }),
    FinePayment.find({
      user: userId,
      paidOn: { $lte: now },
    }).select("amount"),
  ]);

  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;
  const leave = records.filter((r) => r.status === "leave").length;
  const fineOwed = absent * ATTENDANCE_FINE_AMOUNT;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const allTimeFine = calculateFineTotals(allTimeAbsentCount, allTimePayments);

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
    // Fine balance is intentionally all-time even though attendance counts and
    // payment history above remain scoped to the selected month.
    fineBalance: allTimeFine.fineBalance,
    allTimeFineOwed: allTimeFine.fineOwed,
    allTimeFinePaid: allTimeFine.totalPaid,
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
  getWeekRange,
  calculateFineTotals,
};
