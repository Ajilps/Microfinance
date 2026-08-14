import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDashboardSnapshot,
  createMonthBuckets,
} from "../src/controllers/dashboardController.js";

test("dashboard creates six consecutive UTC month buckets", () => {
  const buckets = createMonthBuckets(new Date("2026-08-14T12:00:00.000Z"));
  assert.equal(buckets.length, 6);
  assert.equal(buckets[0].key, "2026-03");
  assert.equal(buckets[5].key, "2026-08");
});

test("dashboard snapshot calculates KPIs and chart series from ledger data", () => {
  const snapshot = buildDashboardSnapshot({
    now: new Date("2026-08-14T12:00:00.000Z"),
    users: [
      {
        _id: "user-1",
        name: "Member One",
        email: "one@example.com",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        _id: "user-2",
        name: "Member Two",
        email: "two@example.com",
        createdAt: new Date("2026-02-01T00:00:00.000Z"),
      },
    ],
    loans: [
      { type: "loan", amount: 1_000, date: new Date("2026-03-10") },
      {
        type: "repayment",
        paymentTarget: "principal",
        amount: 200,
        date: new Date("2026-04-10"),
      },
      { type: "interest", amount: 100, date: new Date("2026-05-10") },
      {
        type: "repayment",
        paymentTarget: "interest",
        amount: 50,
        date: new Date("2026-06-10"),
      },
    ],
    savings: [
      { user: "user-1", amount: 100, paidOn: new Date("2026-03-05") },
      { user: "user-1", amount: 150, paidOn: new Date("2026-04-05") },
      { user: "user-2", amount: 250, paidOn: new Date("2026-04-12") },
    ],
    attendance: [
      {
        weekStartDate: new Date("2026-08-02"),
        status: "present",
      },
      {
        weekStartDate: new Date("2026-08-02"),
        status: "late",
      },
      {
        weekStartDate: new Date("2026-08-09"),
        status: "present",
      },
      {
        weekStartDate: new Date("2026-08-09"),
        status: "absent",
      },
    ],
    bankTransactions: [
      {
        transactionDate: new Date("2026-02-10"),
        deposit: 500,
        withdrawal: 0,
      },
      {
        transactionDate: new Date("2026-03-15"),
        deposit: 100,
        withdrawal: 0,
      },
      {
        transactionDate: new Date("2026-04-15"),
        deposit: 0,
        withdrawal: 50,
      },
    ],
    extras: [],
    distributions: [],
    finePayments: [],
  });

  assert.deepEqual(snapshot.summary, {
    memberCount: 2,
    totalSavings: 500,
    totalLoanDisbursed: 1_000,
    principalOutstanding: 800,
    unpaidInterest: 50,
    bankBalance: 550,
    availableProfit: 50,
    interestCollected: 50,
    principalCollectionRate: 20,
    savingsCoverage: 62.5,
    latestAttendanceRate: 50,
  });
  assert.deepEqual(snapshot.loanComposition, [
    { name: "Principal repaid", value: 200 },
    { name: "Principal outstanding", value: 800 },
  ]);
  assert.equal(snapshot.monthlyActivity[0].loansDisbursed, 1_000);
  assert.equal(snapshot.monthlyActivity[1].savings, 400);
  assert.equal(snapshot.bankTrend[0].balance, 600);
  assert.equal(snapshot.bankTrend[1].balance, 550);
  assert.equal(snapshot.attendanceTrend.at(-1).present, 1);
  assert.equal(snapshot.attendanceTrend.at(-1).absent, 1);
  assert.equal(snapshot.topSavers.length, 2);
});
