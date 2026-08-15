import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMemberDirectory,
  buildMemberWorkspace,
} from "../src/controllers/memberWorkspaceController.js";

const user = {
  _id: "member-1",
  name: "Member One",
  email: "one@example.com",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const loans = [
  {
    _id: "loan-1",
    user: "member-1",
    type: "loan",
    amount: 1_000,
    date: new Date("2026-03-05T00:00:00.000Z"),
  },
  {
    _id: "loan-2",
    user: "member-1",
    type: "repayment",
    paymentTarget: "principal",
    amount: 250,
    date: new Date("2026-04-05T00:00:00.000Z"),
  },
  {
    _id: "loan-3",
    user: "member-1",
    type: "interest",
    amount: 100,
    date: new Date("2026-05-05T00:00:00.000Z"),
  },
  {
    _id: "loan-4",
    user: "member-1",
    type: "repayment",
    paymentTarget: "interest",
    amount: 40,
    date: new Date("2026-06-05T00:00:00.000Z"),
  },
];

const savings = [
  {
    _id: "saving-1",
    user: "member-1",
    amount: 200,
    paidOn: new Date("2026-03-10T00:00:00.000Z"),
  },
  {
    _id: "saving-2",
    user: "member-1",
    amount: 300,
    paidOn: new Date("2026-04-10T00:00:00.000Z"),
  },
];

const savingsWithdrawals = [
  {
    _id: "withdrawal-1",
    user: "member-1",
    amount: 125,
    withdrawalDate: new Date("2026-04-20T00:00:00.000Z"),
    reason: "Medical expenses",
  },
];

const attendance = [
  {
    _id: "attendance-1",
    user: "member-1",
    status: "present",
    attendanceDate: new Date("2026-07-01T00:00:00.000Z"),
  },
  {
    _id: "attendance-2",
    user: "member-1",
    status: "absent",
    attendanceDate: new Date("2026-07-08T00:00:00.000Z"),
  },
];

test("member directory combines savings, loan, and attendance summaries", () => {
  const members = buildMemberDirectory({
    users: [user],
    loans,
    savings,
    savingsWithdrawals,
    attendance,
  });

  assert.equal(members.length, 1);
  assert.deepEqual(
    {
      totalSavings: members[0].totalSavings,
      principalBalance: members[0].principalBalance,
      interestBalance: members[0].interestBalance,
      totalOutstanding: members[0].totalOutstanding,
      attendanceRate: members[0].attendanceRate,
      attendanceSessions: members[0].attendanceSessions,
    },
    {
      totalSavings: 375,
      principalBalance: 750,
      interestBalance: 60,
      totalOutstanding: 810,
      attendanceRate: 50,
      attendanceSessions: 2,
    },
  );
});

test("member workspace returns complete histories, charts, fines, and allocations", () => {
  const workspace = buildMemberWorkspace({
    user,
    loans,
    savings,
    savingsWithdrawals,
    attendance,
    finePayments: [
      {
        _id: "fine-payment-1",
        amount: 10,
        paidOn: new Date("2026-07-10T00:00:00.000Z"),
      },
    ],
    distributions: [
      {
        _id: "distribution-1",
        status: "active",
        distributionDate: new Date("2026-08-01T00:00:00.000Z"),
        asOfDate: new Date("2026-07-31T00:00:00.000Z"),
        unallocationLocked: true,
        allocations: [
          {
            user: "member-1",
            savingsBalance: 500,
            sharePercent: 25,
            amount: 125,
          },
        ],
      },
    ],
    now: new Date("2026-08-14T00:00:00.000Z"),
  });

  assert.equal(workspace.summary.totalSavings, 375);
  assert.equal(workspace.summary.totalSavingsDeposited, 500);
  assert.equal(workspace.summary.totalSavingsWithdrawn, 125);
  assert.equal(workspace.summary.savingsWithdrawals, 1);
  assert.equal(workspace.summary.principalBalance, 750);
  assert.equal(workspace.summary.interestBalance, 60);
  assert.equal(workspace.summary.fineOwed, 20);
  assert.equal(workspace.summary.finePaid, 10);
  assert.equal(workspace.summary.fineBalance, 10);
  assert.equal(workspace.summary.activeProfitAllocated, 125);
  assert.equal(workspace.charts.monthlyFinancialActivity.length, 12);
  assert.equal(workspace.charts.monthlyAttendance.length, 12);
  assert.equal(workspace.attendanceRecords[0]._id, "attendance-2");
  assert.equal(workspace.activity[0].category, "profit");
});
