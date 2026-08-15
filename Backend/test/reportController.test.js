import assert from "node:assert/strict";
import test from "node:test";

import { buildAttendanceSummary } from "../src/controllers/attendanceController.js";
import {
  buildLoanReport,
  buildSavingsReport,
  getReportPeriod,
} from "../src/controllers/reportController.js";

const users = [
  { _id: "user-1", name: "Member One", email: "one@example.com" },
  { _id: "user-2", name: "Member Two", email: "two@example.com" },
];

test("monthly loan report separates period activity from closing balances", () => {
  const period = getReportPeriod({
    scope: "monthly",
    month: 8,
    year: 2026,
  });
  const transactions = [
    {
      user: "user-1",
      type: "loan",
      amount: 1_000,
      date: new Date("2026-07-10T00:00:00Z"),
    },
    {
      user: "user-1",
      type: "repayment",
      paymentTarget: "principal",
      amount: 200,
      date: new Date("2026-08-12T00:00:00Z"),
    },
    {
      user: "user-1",
      type: "interest",
      amount: 10,
      date: new Date("2026-08-13T00:00:00Z"),
    },
    {
      user: "user-2",
      type: "loan",
      amount: 500,
      date: new Date("2026-07-01T00:00:00Z"),
    },
    {
      user: "user-2",
      type: "repayment",
      paymentTarget: "principal",
      amount: 500,
      date: new Date("2026-07-20T00:00:00Z"),
    },
  ];

  const report = buildLoanReport({ users, transactions, period });
  const member = report.rows[0];

  assert.equal(member.transactionCount, 2);
  assert.equal(member.disbursed, 0);
  assert.equal(member.principalRepaid, 200);
  assert.equal(member.interestCharged, 10);
  assert.equal(member.principalBalance, 800);
  assert.equal(member.interestBalance, 10);
  assert.equal(member.totalOutstanding, 810);
  assert.equal(member.activeLoanDisbursed, 1_000);
  assert.equal(report.rows[1].totalOutstanding, 0);
  assert.equal(report.rows[1].activeLoanDisbursed, 0);
  assert.equal(report.totals.activeLoanDisbursed, 1_000);
});

test("savings report shows selected-month deposits and balance through month end", () => {
  const period = getReportPeriod({
    scope: "monthly",
    month: 8,
    year: 2026,
  });
  const payments = [
    {
      user: "user-1",
      amount: 100,
      paidOn: new Date("2026-07-20T00:00:00Z"),
    },
    {
      user: "user-1",
      amount: 250,
      paidOn: new Date("2026-08-12T00:00:00Z"),
    },
    {
      user: "user-1",
      amount: 400,
      paidOn: new Date("2026-09-01T00:00:00Z"),
    },
  ];
  const withdrawals = [
    {
      user: "user-1",
      amount: 80,
      withdrawalDate: new Date("2026-08-20T00:00:00Z"),
    },
  ];

  const report = buildSavingsReport({ users, payments, withdrawals, period });
  const member = report.rows[0];

  assert.equal(member.paymentCount, 1);
  assert.equal(member.amountSaved, 250);
  assert.equal(member.withdrawalCount, 1);
  assert.equal(member.amountWithdrawn, 80);
  assert.equal(member.netSavingsMovement, 170);
  assert.equal(member.savingsBalance, 270);
  assert.equal(member.savingsInterest, 2.7);
  assert.equal(report.totals.savingsBalance, 270);
});

test("all-time attendance report includes fine payments and balances", () => {
  const records = [
    { user: "user-1", status: "present" },
    { user: "user-1", status: "absent" },
    { user: "user-1", status: "late" },
  ];
  const finePayments = [{ user: "user-1", amount: 10 }];

  const [member, emptyMember] = buildAttendanceSummary(
    users,
    records,
    finePayments,
  );

  assert.deepEqual(
    {
      weeks: member.totalWeeks,
      present: member.present,
      absent: member.absent,
      late: member.late,
      fineOwed: member.fineOwed,
      totalPaid: member.totalPaid,
      balance: member.balance,
    },
    {
      weeks: 3,
      present: 1,
      absent: 1,
      late: 1,
      fineOwed: 20,
      totalPaid: 10,
      balance: 10,
    },
  );
  assert.equal(emptyMember.totalWeeks, 0);
});

test("monthly report requires a valid month and year", () => {
  assert.throws(
    () => getReportPeriod({ scope: "monthly", month: 13, year: 2026 }),
    /valid month and year/,
  );
});
