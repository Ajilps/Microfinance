import Attendance from "../models/attendanceModel.js";
import BankTransaction from "../models/bankTransactionModel.js";
import ExtraTransaction from "../models/extraTransactionModel.js";
import FinePayment from "../models/finePaymentModel.js";
import LoanTransaction from "../models/loanModel.js";
import ProfitDistribution from "../models/profitDistributionModel.js";
import SavingsPayment from "../models/savingsModel.js";
import User from "../models/userModel.js";
import { buildBankLedger } from "./bankTransactionController.js";
import { computeLoanSummary } from "./loanController.js";
import { buildProfitSummary } from "./profitController.js";

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const createMonthBuckets = (now, count = 6) => {
  const buckets = [];
  const currentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  for (let offset = count - 1; offset >= 0; offset -= 1) {
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
    buckets.push({
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }),
      start,
      endExclusive,
    });
  }
  return buckets;
};

const isInRange = (value, start, endExclusive) => {
  const date = new Date(value);
  return date >= start && date < endExclusive;
};

const buildDashboardSnapshot = ({
  users,
  loans,
  savings,
  attendance,
  bankTransactions,
  extras,
  distributions,
  finePayments,
  now = new Date(),
}) => {
  const loanSummary = computeLoanSummary(loans);
  const profitSummary = buildProfitSummary({
    loans,
    extras,
    distributions,
    finePayments,
  });
  const sortedBankTransactions = [...bankTransactions].sort(
    (left, right) =>
      new Date(left.transactionDate) - new Date(right.transactionDate) ||
      new Date(left.createdAt || 0) - new Date(right.createdAt || 0),
  );
  const bankLedger = buildBankLedger(sortedBankTransactions);
  const totalSavings = savings.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
  const principalCollectionRate = loanSummary.totalDisbursed
    ? (loanSummary.totalPrincipalRepaid / loanSummary.totalDisbursed) * 100
    : 0;
  const savingsCoverage = loanSummary.principalBalance
    ? (totalSavings / loanSummary.principalBalance) * 100
    : 0;

  const monthBuckets = createMonthBuckets(now);
  const monthlyActivity = monthBuckets.map((bucket) => ({
    month: bucket.label,
    savings: roundMoney(
      savings
        .filter((payment) =>
          isInRange(payment.paidOn, bucket.start, bucket.endExclusive),
        )
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    ),
    loansDisbursed: roundMoney(
      loans
        .filter(
          (transaction) =>
            transaction.type === "loan" &&
            isInRange(transaction.date, bucket.start, bucket.endExclusive),
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    ),
    repayments: roundMoney(
      loans
        .filter(
          (transaction) =>
            transaction.type === "repayment" &&
            isInRange(transaction.date, bucket.start, bucket.endExclusive),
        )
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    ),
  }));

  let bankBalance = sortedBankTransactions
    .filter(
      (transaction) =>
        new Date(transaction.transactionDate) < monthBuckets[0].start,
    )
    .reduce(
      (sum, transaction) =>
        sum +
        Number(transaction.deposit || 0) -
        Number(transaction.withdrawal || 0),
      0,
    );
  const bankTrend = monthBuckets.map((bucket) => {
    const monthlyTransactions = sortedBankTransactions.filter((transaction) =>
      isInRange(
        transaction.transactionDate,
        bucket.start,
        bucket.endExclusive,
      ),
    );
    const deposits = monthlyTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.deposit || 0),
      0,
    );
    const withdrawals = monthlyTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.withdrawal || 0),
      0,
    );
    bankBalance += deposits - withdrawals;
    return {
      month: bucket.label,
      deposits: roundMoney(deposits),
      withdrawals: roundMoney(withdrawals),
      balance: roundMoney(bankBalance),
    };
  });

  const userNames = new Map(
    users.map((user) => [String(user._id), user.name]),
  );
  const savingsByUser = new Map();
  for (const payment of savings) {
    const userId = String(payment.user?._id || payment.user);
    savingsByUser.set(
      userId,
      (savingsByUser.get(userId) || 0) + Number(payment.amount || 0),
    );
  }
  const topSavers = [...savingsByUser.entries()]
    .map(([userId, amount]) => ({
      name: userNames.get(userId) || "Unknown member",
      amount: roundMoney(amount),
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);

  const attendanceSessions = new Map();
  for (const record of attendance) {
    const key = new Date(record.weekStartDate).toISOString();
    if (!attendanceSessions.has(key)) {
      attendanceSessions.set(key, {
        date: new Date(record.weekStartDate),
        present: 0,
        absent: 0,
        late: 0,
        leave: 0,
      });
    }
    const session = attendanceSessions.get(key);
    if (Object.hasOwn(session, record.status)) session[record.status] += 1;
  }
  const attendanceTrend = [...attendanceSessions.values()]
    .sort((left, right) => left.date - right.date)
    .slice(-8)
    .map((session) => ({
      week: session.date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      present: session.present,
      absent: session.absent,
      late: session.late,
      leave: session.leave,
    }));
  const latestAttendance = attendanceTrend.at(-1);
  const latestAttendanceTotal = latestAttendance
    ? latestAttendance.present +
      latestAttendance.absent +
      latestAttendance.late +
      latestAttendance.leave
    : 0;
  const latestAttendanceRate = latestAttendanceTotal
    ? (latestAttendance.present / latestAttendanceTotal) * 100
    : 0;

  return {
    generatedAt: now,
    summary: {
      memberCount: users.length,
      totalSavings: roundMoney(totalSavings),
      totalLoanDisbursed: roundMoney(loanSummary.totalDisbursed),
      principalOutstanding: roundMoney(loanSummary.principalBalance),
      unpaidInterest: roundMoney(loanSummary.interestBalance),
      bankBalance: bankLedger.totals.currentBalance,
      availableProfit: profitSummary.availableToDistribute,
      interestCollected: roundMoney(loanSummary.totalInterestRepaid),
      principalCollectionRate: roundMoney(principalCollectionRate),
      savingsCoverage: roundMoney(savingsCoverage),
      latestAttendanceRate: roundMoney(latestAttendanceRate),
    },
    monthlyActivity,
    loanComposition: [
      {
        name: "Principal repaid",
        value: roundMoney(loanSummary.totalPrincipalRepaid),
      },
      {
        name: "Principal outstanding",
        value: roundMoney(loanSummary.principalBalance),
      },
    ],
    attendanceTrend,
    bankTrend,
    topSavers,
    recentMembers: users
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 5)
      .map(({ _id, name, email, createdAt }) => ({
        _id,
        name,
        email,
        createdAt,
      })),
  };
};

const getDashboardOverview = async (req, res) => {
  const [
    users,
    loans,
    savings,
    attendance,
    bankTransactions,
    extras,
    distributions,
    finePayments,
  ] = await Promise.all([
    User.find({ role: "user" }).select("name email createdAt"),
    LoanTransaction.find().sort({ date: 1, createdAt: 1 }),
    SavingsPayment.find().sort({ paidOn: 1, createdAt: 1 }),
    Attendance.find().sort({ weekStartDate: 1 }),
    BankTransaction.find().sort({ transactionDate: 1, createdAt: 1 }),
    ExtraTransaction.find(),
    ProfitDistribution.find(),
    FinePayment.find(),
  ]);

  return res.json(
    buildDashboardSnapshot({
      users,
      loans,
      savings,
      attendance,
      bankTransactions,
      extras,
      distributions,
      finePayments,
    }),
  );
};

export { buildDashboardSnapshot, createMonthBuckets, getDashboardOverview };
