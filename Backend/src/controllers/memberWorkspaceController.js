import Attendance from "../models/attendanceModel.js";
import {
  ATTENDANCE_FINE_AMOUNT,
  DASHBOARD_HISTORY_MONTHS,
} from "../config/constants.js";
import FinePayment from "../models/finePaymentModel.js";
import LoanTransaction from "../models/loanModel.js";
import ProfitDistribution from "../models/profitDistributionModel.js";
import SavingsPayment from "../models/savingsModel.js";
import SavingsWithdrawal from "../models/savingsWithdrawalModel.js";
import User from "../models/userModel.js";
import { computeLoanSummary } from "../services/loanLedgerService.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const toTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const isInRange = (value, start, endExclusive) => {
  const time = toTime(value);
  return time >= start.getTime() && time < endExclusive.getTime();
};

const createMonthBuckets = (now, count = DASHBOARD_HISTORY_MONTHS) => {
  const currentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );

  return Array.from({ length: count }, (_, index) => {
    const offset = count - index - 1;
    const start = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() - offset,
        1,
      ),
    );
    const endExclusive = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
    );
    return {
      month: start.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      start,
      endExclusive,
    };
  });
};

const groupByUser = (records) => {
  const grouped = new Map();
  for (const record of records) {
    const userId = String(record.user?._id || record.user);
    if (!grouped.has(userId)) grouped.set(userId, []);
    grouped.get(userId).push(record);
  }
  return grouped;
};

const latestRecordTime = (records, fields) =>
  records.reduce(
    (latest, record) =>
      Math.max(latest, ...fields.map((field) => toTime(record[field]))),
    0,
  );

const buildMemberDirectory = ({
  users,
  loans,
  savings,
  savingsWithdrawals = [],
  attendance,
  finePayments = [],
  distributions = [],
}) => {
  const loansByUser = groupByUser(loans);
  const savingsByUser = groupByUser(savings);
  const withdrawalsByUser = groupByUser(savingsWithdrawals);
  const attendanceByUser = groupByUser(attendance);
  const finePaymentsByUser = groupByUser(finePayments);
  const allocationsByUser = new Map();
  for (const distribution of distributions) {
    for (const allocation of distribution.allocations || []) {
      const userId = String(allocation.user?._id || allocation.user);
      if (!allocationsByUser.has(userId)) allocationsByUser.set(userId, []);
      allocationsByUser.get(userId).push({
        distributionDate: distribution.distributionDate,
        createdAt: distribution.createdAt,
      });
    }
  }

  return users
    .map((user) => {
      const userId = String(user._id);
      const userLoans = [...(loansByUser.get(userId) || [])].sort(
        (left, right) => toTime(left.date) - toTime(right.date),
      );
      const userSavings = savingsByUser.get(userId) || [];
      const userWithdrawals = withdrawalsByUser.get(userId) || [];
      const userAttendance = attendanceByUser.get(userId) || [];
      const userFinePayments = finePaymentsByUser.get(userId) || [];
      const userAllocations = allocationsByUser.get(userId) || [];
      const loanSummary = computeLoanSummary(userLoans);
      const totalSavings =
        userSavings.reduce(
          (sum, payment) => sum + Number(payment.amount || 0),
          0,
        ) -
        userWithdrawals.reduce(
          (sum, withdrawal) => sum + Number(withdrawal.amount || 0),
          0,
        );
      const present = userAttendance.filter(
        (record) => record.status === "present",
      ).length;
      const attendanceRate = userAttendance.length
        ? (present / userAttendance.length) * 100
        : 0;
      const lastActivityAt = Math.max(
        latestRecordTime(userLoans, ["date", "createdAt"]),
        latestRecordTime(userSavings, ["paidOn", "createdAt"]),
        latestRecordTime(userWithdrawals, ["withdrawalDate", "createdAt"]),
        latestRecordTime(userAttendance, ["attendanceDate", "createdAt"]),
        latestRecordTime(userFinePayments, ["paidOn", "createdAt"]),
        latestRecordTime(userAllocations, ["distributionDate", "createdAt"]),
      );

      return {
        userId: user._id,
        name: user.name,
        email: user.email,
        joinedAt: user.createdAt,
        totalSavings: roundMoney(totalSavings),
        principalBalance: roundMoney(loanSummary.principalBalance),
        interestBalance: roundMoney(loanSummary.interestBalance),
        totalOutstanding: roundMoney(loanSummary.totalOutstanding),
        attendanceRate: roundMoney(attendanceRate),
        attendanceSessions: userAttendance.length,
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
};

const buildMemberWorkspace = ({
  user,
  loans,
  savings,
  savingsWithdrawals = [],
  attendance,
  finePayments,
  distributions,
  now = new Date(),
}) => {
  const chronologicalLoans = [...loans].sort(
    (left, right) => toTime(left.date) - toTime(right.date),
  );
  const chronologicalSavings = [...savings].sort(
    (left, right) => toTime(left.paidOn) - toTime(right.paidOn),
  );
  const chronologicalWithdrawals = [...savingsWithdrawals].sort(
    (left, right) =>
      toTime(left.withdrawalDate) - toTime(right.withdrawalDate),
  );
  const loanSummary = computeLoanSummary(chronologicalLoans);
  const totalDeposits = chronologicalSavings.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const totalWithdrawals = chronologicalWithdrawals.reduce(
    (sum, withdrawal) => sum + Number(withdrawal.amount || 0),
    0,
  );
  const totalSavings = totalDeposits - totalWithdrawals;
  const attendanceCounts = {
    present: 0,
    absent: 0,
    late: 0,
    leave: 0,
  };
  for (const record of attendance) {
    if (Object.hasOwn(attendanceCounts, record.status)) {
      attendanceCounts[record.status] += 1;
    }
  }
  const totalAttendance = Object.values(attendanceCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const fineOwed = attendanceCounts.absent * ATTENDANCE_FINE_AMOUNT;
  const finePaid = finePayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const profitAllocations = distributions
    .flatMap((distribution) =>
      (distribution.allocations || [])
        .filter(
          (allocation) =>
            String(allocation.user?._id || allocation.user) === String(user._id),
        )
        .map((allocation) => ({
          distributionId: distribution._id,
          distributionDate: distribution.distributionDate,
          fromDate: distribution.fromDate,
          tillDate: distribution.tillDate,
          asOfDate: distribution.asOfDate,
          status: distribution.status,
          unallocationLocked: Boolean(distribution.unallocationLocked),
          savingsBalance: roundMoney(allocation.savingsBalance),
          sharePercent: roundMoney(allocation.sharePercent),
          amount: roundMoney(allocation.amount),
        })),
    )
    .sort(
      (left, right) =>
        toTime(right.distributionDate) - toTime(left.distributionDate),
    );
  const activeProfitAllocated = profitAllocations
    .filter((allocation) => allocation.status === "active")
    .reduce((sum, allocation) => sum + allocation.amount, 0);

  const monthBuckets = createMonthBuckets(now);
  let cumulativeSavings = chronologicalSavings
    .filter((payment) => toTime(payment.paidOn) < monthBuckets[0].start.getTime())
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  cumulativeSavings -= chronologicalWithdrawals
    .filter(
      (withdrawal) =>
        toTime(withdrawal.withdrawalDate) < monthBuckets[0].start.getTime(),
    )
    .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);

  const monthlyFinancialActivity = monthBuckets.map((bucket) => {
    const savingsAdded = chronologicalSavings
      .filter((payment) =>
        isInRange(payment.paidOn, bucket.start, bucket.endExclusive),
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const savingsWithdrawn = chronologicalWithdrawals
      .filter((withdrawal) =>
        isInRange(
          withdrawal.withdrawalDate,
          bucket.start,
          bucket.endExclusive,
        ),
      )
      .reduce((sum, withdrawal) => sum + Number(withdrawal.amount || 0), 0);
    const loansDisbursed = chronologicalLoans
      .filter(
        (transaction) =>
          transaction.type === "loan" &&
          isInRange(transaction.date, bucket.start, bucket.endExclusive),
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const repayments = chronologicalLoans
      .filter(
          (transaction) =>
            ["repayment", "closure"].includes(transaction.type) &&
            isInRange(transaction.date, bucket.start, bucket.endExclusive),
      )
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    cumulativeSavings += savingsAdded - savingsWithdrawn;

    return {
      month: bucket.month,
      savingsAdded: roundMoney(savingsAdded),
      savingsWithdrawn: roundMoney(savingsWithdrawn),
      savingsBalance: roundMoney(cumulativeSavings),
      loansDisbursed: roundMoney(loansDisbursed),
      repayments: roundMoney(repayments),
    };
  });

  const monthlyAttendance = monthBuckets.map((bucket) => {
    const records = attendance.filter((record) =>
      isInRange(
        record.attendanceDate,
        bucket.start,
        bucket.endExclusive,
      ),
    );
    return {
      month: bucket.month,
      present: records.filter((record) => record.status === "present").length,
      absent: records.filter((record) => record.status === "absent").length,
      late: records.filter((record) => record.status === "late").length,
      leave: records.filter((record) => record.status === "leave").length,
    };
  });

  const activity = [
    ...chronologicalSavings.map((payment) => ({
      id: payment._id,
      category: "savings",
      type: "Savings payment",
      amount: roundMoney(payment.amount),
      date: payment.paidOn,
      note: payment.note || "",
    })),
    ...chronologicalWithdrawals.map((withdrawal) => ({
      id: withdrawal._id,
      category: "savings-withdrawal",
      type: "Savings withdrawal",
      amount: roundMoney(withdrawal.amount),
      date: withdrawal.withdrawalDate,
      note: withdrawal.reason || withdrawal.note || "",
    })),
    ...chronologicalLoans.map((transaction) => ({
      id: transaction._id,
      category: "loan",
      type:
        transaction.type === "closure"
          ? "Loan closure payment"
          : transaction.type === "repayment"
          ? `${transaction.paymentTarget || "Loan"} repayment`
          : transaction.type,
      amount: roundMoney(transaction.amount),
      date: transaction.date,
      note: transaction.note || "",
    })),
    ...finePayments.map((payment) => ({
      id: payment._id,
      category: "attendance-fine",
      type: "Attendance fine payment",
      amount: roundMoney(payment.amount),
      date: payment.paidOn,
      note: payment.note || "",
    })),
    ...profitAllocations.map((allocation) => ({
      id: allocation.distributionId,
      category: "profit",
      type:
        allocation.status === "active"
          ? "Profit allocation"
          : "Reversed profit allocation",
      amount: allocation.amount,
      date: allocation.distributionDate,
      note: `${allocation.sharePercent.toFixed(2)}% share`,
    })),
  ].sort((left, right) => toTime(right.date) - toTime(left.date));

  return {
    generatedAt: now,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    summary: {
      totalSavings: roundMoney(totalSavings),
      totalSavingsDeposited: roundMoney(totalDeposits),
      totalSavingsWithdrawn: roundMoney(totalWithdrawals),
      savingsPayments: savings.length,
      savingsWithdrawals: savingsWithdrawals.length,
      ...Object.fromEntries(
        Object.entries(loanSummary).map(([key, value]) => [key, roundMoney(value)]),
      ),
      attendanceRate: totalAttendance
        ? roundMoney((attendanceCounts.present / totalAttendance) * 100)
        : 0,
      attendanceSessions: totalAttendance,
      fineOwed: roundMoney(fineOwed),
      finePaid: roundMoney(finePaid),
      fineBalance: roundMoney(fineOwed - finePaid),
      activeProfitAllocated: roundMoney(activeProfitAllocated),
    },
    charts: {
      monthlyFinancialActivity,
      monthlyAttendance,
      loanPrincipal: [
        {
          name: "Principal repaid",
          value: roundMoney(loanSummary.totalPrincipalRepaid),
        },
        {
          name: "Principal outstanding",
          value: roundMoney(loanSummary.principalBalance),
        },
      ],
      attendanceStatus: Object.entries(attendanceCounts).map(([name, value]) => ({
        name: name[0].toUpperCase() + name.slice(1),
        value,
      })),
    },
    savingsPayments: [...savings].sort(
      (left, right) => toTime(right.paidOn) - toTime(left.paidOn),
    ),
    savingsWithdrawals: [...savingsWithdrawals].sort(
      (left, right) =>
        toTime(right.withdrawalDate) - toTime(left.withdrawalDate),
    ),
    loanTransactions: [...loans].sort(
      (left, right) => toTime(right.date) - toTime(left.date),
    ),
    attendanceRecords: [...attendance].sort(
      (left, right) =>
        toTime(right.attendanceDate) - toTime(left.attendanceDate),
    ),
    finePayments: [...finePayments].sort(
      (left, right) => toTime(right.paidOn) - toTime(left.paidOn),
    ),
    profitAllocations,
    activity,
  };
};

const getMemberDirectory = async (req, res) => {
  const [
    users,
    loans,
    savings,
    savingsWithdrawals,
    attendance,
    finePayments,
    distributions,
  ] =
    await Promise.all([
      User.find({ role: "user" }).select("name email createdAt").lean(),
      LoanTransaction.find()
        .select(
          "user type amount paymentTarget date createdAt closureDetails",
        )
        .lean(),
      SavingsPayment.find().select("user amount paidOn createdAt").lean(),
      SavingsWithdrawal.find()
        .select("user amount withdrawalDate createdAt")
        .lean(),
      Attendance.find().select("user status attendanceDate createdAt").lean(),
      FinePayment.find().select("user paidOn createdAt").lean(),
      ProfitDistribution.find()
        .select("allocations.user distributionDate createdAt")
        .lean(),
    ]);

  return res.json({
    generatedAt: new Date(),
    members: buildMemberDirectory({
      users,
      loans,
      savings,
      savingsWithdrawals,
      attendance,
      finePayments,
      distributions,
    }),
  });
};

const getMemberWorkspace = async (req, res) => {
  const { userId } = req.params;
  const user = await User.findOne({ _id: userId, role: "user" })
    .select("name email createdAt updatedAt")
    .lean();
  if (!user) return res.status(404).json({ message: "User not found" });

  const [
    loans,
    savings,
    savingsWithdrawals,
    attendance,
    finePayments,
    distributions,
  ] =
    await Promise.all([
      LoanTransaction.find({ user: userId })
        .populate("recordedBy", "name")
        .lean(),
      SavingsPayment.find({ user: userId })
        .populate("recordedBy", "name")
        .lean(),
      SavingsWithdrawal.find({ user: userId })
        .populate("recordedBy", "name")
        .populate("updatedBy", "name")
        .lean(),
      Attendance.find({ user: userId })
        .populate("markedBy", "name")
        .lean(),
      FinePayment.find({ user: userId })
        .populate("recordedBy", "name")
        .lean(),
      ProfitDistribution.find({ "allocations.user": userId }).lean(),
    ]);

  return res.json(
    buildMemberWorkspace({
      user,
      loans,
      savings,
      savingsWithdrawals,
      attendance,
      finePayments,
      distributions,
    }),
  );
};

export {
  buildMemberDirectory,
  buildMemberWorkspace,
  createMonthBuckets,
  getMemberDirectory,
  getMemberWorkspace,
};
