import { Parser } from "json2csv";

import LoanTransaction from "../models/loanModel.js";
import SavingsPayment from "../models/savingsModel.js";
import User from "../models/userModel.js";
import { computeLoanSummary } from "./loanController.js";

const REPORT_SCOPES = new Set(["monthly", "all"]);

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const getReportPeriod = ({ scope = "monthly", month, year } = {}) => {
  if (!REPORT_SCOPES.has(scope)) {
    throw new Error("scope must be 'monthly' or 'all'");
  }

  if (scope === "all") {
    return {
      scope,
      start: null,
      endExclusive: new Date(),
      label: "All Time",
      filenameLabel: "all-time",
    };
  }

  const parsedMonth = Number(month);
  const parsedYear = Number(year);
  if (
    !Number.isInteger(parsedMonth) ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    !Number.isInteger(parsedYear) ||
    parsedYear < 2000 ||
    parsedYear > 2100
  ) {
    throw new Error("A valid month and year are required for monthly reports");
  }

  const start = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
  const endExclusive = new Date(Date.UTC(parsedYear, parsedMonth, 1));
  const monthName = start.toLocaleString("en", {
    month: "long",
    timeZone: "UTC",
  });

  return {
    scope,
    month: parsedMonth,
    year: parsedYear,
    start,
    endExclusive,
    label: `${monthName} ${parsedYear}`,
    filenameLabel: `${monthName.toLowerCase()}-${parsedYear}`,
  };
};

const isInPeriod = (date, period) => {
  const value = new Date(date);
  if (period.scope === "all") return value <= period.endExclusive;
  return value >= period.start && value < period.endExclusive;
};

const isIncludedInBalance = (date, period) => {
  if (period.scope === "all") return new Date(date) <= period.endExclusive;
  return new Date(date) < period.endExclusive;
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

const sumRows = (rows, fields) =>
  fields.reduce(
    (totals, field) => ({
      ...totals,
      [field]: roundMoney(
        rows.reduce((sum, row) => sum + Number(row[field] || 0), 0),
      ),
    }),
    { members: rows.length },
  );

const buildLoanReport = ({ users, transactions, period }) => {
  const grouped = groupByUser(transactions);

  const rows = users.map((user) => {
    const userTransactions = grouped.get(String(user._id)) || [];
    const activity = userTransactions.filter((tx) => isInPeriod(tx.date, period));
    const balanceTransactions = userTransactions.filter((tx) =>
      isIncludedInBalance(tx.date, period),
    );
    const activitySummary = computeLoanSummary(activity);
    const balanceSummary = computeLoanSummary(balanceTransactions);
    const hasActiveLoan = balanceSummary.totalOutstanding > 0;

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      transactionCount: activity.length,
      disbursed: roundMoney(activitySummary.totalDisbursed),
      activeLoanDisbursed: hasActiveLoan
        ? roundMoney(balanceSummary.totalDisbursed)
        : 0,
      principalRepaid: roundMoney(activitySummary.totalPrincipalRepaid),
      interestCharged: roundMoney(activitySummary.totalInterestAccrued),
      interestRepaid: roundMoney(activitySummary.totalInterestRepaid),
      finesCharged: roundMoney(activitySummary.totalFines),
      principalBalance: roundMoney(balanceSummary.principalBalance),
      interestBalance: roundMoney(balanceSummary.interestBalance),
      totalOutstanding: roundMoney(balanceSummary.totalOutstanding),
    };
  });

  return {
    rows,
    totals: sumRows(rows, [
      "transactionCount",
      "disbursed",
      "activeLoanDisbursed",
      "principalRepaid",
      "interestCharged",
      "interestRepaid",
      "finesCharged",
      "principalBalance",
      "interestBalance",
      "totalOutstanding",
    ]),
  };
};

const buildSavingsReport = ({ users, payments, period }) => {
  const grouped = groupByUser(payments);

  const rows = users.map((user) => {
    const userPayments = grouped.get(String(user._id)) || [];
    const activity = userPayments.filter((payment) =>
      isInPeriod(payment.paidOn, period),
    );
    const balancePayments = userPayments.filter((payment) =>
      isIncludedInBalance(payment.paidOn, period),
    );
    const amountSaved = activity.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const savingsBalance = balancePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );
    const lastPaidOn = balancePayments.reduce((latest, payment) => {
      const paidOn = new Date(payment.paidOn);
      return !latest || paidOn > latest ? paidOn : latest;
    }, null);

    return {
      userId: user._id,
      name: user.name,
      email: user.email,
      paymentCount: activity.length,
      amountSaved: roundMoney(amountSaved),
      savingsBalance: roundMoney(savingsBalance),
      savingsInterest: roundMoney(savingsBalance * 0.01),
      lastPaidOn,
    };
  });

  return {
    rows,
    totals: sumRows(rows, [
      "paymentCount",
      "amountSaved",
      "savingsBalance",
      "savingsInterest",
    ]),
  };
};

const getReportData = async (type, query) => {
  const period = getReportPeriod(query);
  const users = await User.find({ role: "user" })
    .select("name email")
    .sort({ name: 1 });

  if (type === "loans") {
    const dateQuery =
      period.scope === "monthly"
        ? { date: { $lt: period.endExclusive } }
        : { date: { $lte: period.endExclusive } };
    const transactions = await LoanTransaction.find(dateQuery).sort({ date: 1 });
    return {
      reportType: "loans",
      period,
      ...buildLoanReport({ users, transactions, period }),
    };
  }

  const dateQuery =
    period.scope === "monthly"
      ? { paidOn: { $lt: period.endExclusive } }
      : { paidOn: { $lte: period.endExclusive } };
  const payments = await SavingsPayment.find(dateQuery).sort({ paidOn: 1 });
  return {
    reportType: "savings",
    period,
    ...buildSavingsReport({ users, payments, period }),
  };
};

const sendReportJson = (type) => async (req, res) => {
  try {
    const report = await getReportData(type, req.query);
    res.json({
      reportType: report.reportType,
      scope: report.period.scope,
      periodLabel: report.period.label,
      generatedAt: new Date(),
      rows: report.rows,
      totals: report.totals,
    });
  } catch (error) {
    if (error.message.includes("scope") || error.message.includes("month")) {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  }
};

const sendReportCsv = (type) => async (req, res) => {
  try {
    const report = await getReportData(type, req.query);
    const isLoanReport = type === "loans";
    const rows = report.rows.map((row) =>
      isLoanReport
        ? {
            Name: row.name,
            Email: row.email,
            Transactions: row.transactionCount,
            "Loans Disbursed (INR)": row.disbursed,
            "Distributed for Active Loan Ledger (INR)":
              row.activeLoanDisbursed,
            "Principal Repaid (INR)": row.principalRepaid,
            "Interest Charged (INR)": row.interestCharged,
            "Interest Repaid (INR)": row.interestRepaid,
            "Loan Fines (INR)": row.finesCharged,
            "Principal Balance (INR)": row.principalBalance,
            "Interest Balance (INR)": row.interestBalance,
            "Total Outstanding (INR)": row.totalOutstanding,
          }
        : {
            Name: row.name,
            Email: row.email,
            Payments: row.paymentCount,
            "Saved in Period (INR)": row.amountSaved,
            "Savings Balance (INR)": row.savingsBalance,
            "Savings Interest 1% (INR)": row.savingsInterest,
            "Last Paid On": row.lastPaidOn
              ? new Date(row.lastPaidOn).toISOString().slice(0, 10)
              : "",
          },
    );
    const csv = new Parser().parse(rows);
    const filename = `${type}-${report.period.filenameLabel}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`,
    );
    res.send(csv);
  } catch (error) {
    if (error.message.includes("scope") || error.message.includes("month")) {
      return res.status(400).json({ message: error.message });
    }
    throw error;
  }
};

const getLoanReport = sendReportJson("loans");
const downloadLoanReport = sendReportCsv("loans");
const getSavingsReport = sendReportJson("savings");
const downloadSavingsReport = sendReportCsv("savings");

export {
  buildLoanReport,
  buildSavingsReport,
  downloadLoanReport,
  downloadSavingsReport,
  getLoanReport,
  getReportPeriod,
  getSavingsReport,
};
