import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProfitAllocations,
  buildProfitSummary,
  createDistributionCalculationKey,
  getAsOfRange,
} from "../src/controllers/profitController.js";
import ProfitDistribution from "../src/models/profitDistributionModel.js";

test("profit summary separates accrued profit from distributable cash profit", () => {
  const summary = buildProfitSummary({
    loans: [
      { type: "loan", amount: 10_000 },
      {
        type: "repayment",
        paymentTarget: "principal",
        amount: 2_000,
      },
      { type: "interest", amount: 500 },
      {
        type: "repayment",
        paymentTarget: "interest",
        amount: 300,
      },
    ],
    extras: [
      { type: "income", amount: 100 },
      { type: "expense", amount: 50 },
    ],
    finePayments: [{ amount: 20 }],
    distributions: [{ amount: 75 }],
  });

  assert.deepEqual(summary, {
    totalLoanDistributed: 10_000,
    totalPrincipalPaid: 2_000,
    totalReturn: 2_300,
    totalInterestGenerated: 500,
    totalInterestPaid: 300,
    totalUnpaidLoan: 8_000,
    unpaidInterest: 200,
    loanFinesGenerated: 0,
    attendanceFineIncome: 20,
    otherIncome: 100,
    otherExpenses: 50,
    revenue: 620,
    expenses: 50,
    accruedProfit: 570,
    cashRevenue: 420,
    cashProfit: 370,
    previouslyDistributed: 75,
    availableToDistribute: 295,
  });
});

test("profit allocations are proportional and preserve the exact cent total", () => {
  const users = [
    { _id: "user-1", name: "A", email: "a@example.com" },
    { _id: "user-2", name: "B", email: "b@example.com" },
    { _id: "user-3", name: "C", email: "c@example.com" },
  ];
  const savingsPayments = [
    { user: "user-1", amount: 100 },
    { user: "user-2", amount: 200 },
    { user: "user-3", amount: 300 },
  ];

  const result = buildProfitAllocations({
    users,
    savingsPayments,
    amount: 100,
  });

  assert.equal(result.totalSavings, 600);
  assert.equal(
    result.allocations.reduce((sum, allocation) => sum + allocation.amount, 0),
    100,
  );
  assert.deepEqual(
    result.allocations.map((allocation) => allocation.amount),
    [16.67, 33.33, 50],
  );
});

test("members without savings do not receive a profit allocation", () => {
  const result = buildProfitAllocations({
    users: [
      { _id: "saved", name: "Saved", email: "" },
      { _id: "empty", name: "Empty", email: "" },
    ],
    savingsPayments: [{ user: "saved", amount: 250 }],
    amount: 25,
  });

  assert.equal(result.allocations.length, 1);
  assert.equal(String(result.allocations[0].userId), "saved");
  assert.equal(result.allocations[0].amount, 25);
});

test("reversed distributions are restored to available profit", () => {
  const baseData = {
    loans: [
      { type: "interest", amount: 500 },
      { type: "repayment", paymentTarget: "interest", amount: 500 },
    ],
    extras: [],
    finePayments: [],
  };

  const active = buildProfitSummary({
    ...baseData,
    distributions: [{ amount: 200, status: "active" }],
  });
  const reversed = buildProfitSummary({
    ...baseData,
    distributions: [{ amount: 200, status: "reversed" }],
  });

  assert.equal(active.availableToDistribute, 300);
  assert.equal(reversed.availableToDistribute, 500);
  assert.equal(reversed.previouslyDistributed, 0);
});

test("distribution calculation key changes after a recorded payout", () => {
  const common = {
    asOfDate: "2026-08-12",
    amount: 100,
    allocations: [
      { userId: "user-1", savingsBalance: 400 },
      { userId: "user-2", savingsBalance: 600 },
    ],
  };
  const before = createDistributionCalculationKey({
    ...common,
    summary: {
      cashProfit: 500,
      previouslyDistributed: 0,
      availableToDistribute: 500,
    },
  });
  const after = createDistributionCalculationKey({
    ...common,
    summary: {
      cashProfit: 500,
      previouslyDistributed: 100,
      availableToDistribute: 400,
    },
  });

  assert.notEqual(before, after);
});

test("new profit distributions allow un-allocation until explicitly locked", () => {
  const distribution = new ProfitDistribution();
  assert.equal(distribution.status, "active");
  assert.equal(distribution.unallocationLocked, false);
  assert.equal(distribution.unallocationLockedAt, null);
  assert.equal(distribution.unallocationLockedBy, null);
});

test("as-of date validation rejects future dates", () => {
  assert.throws(() => getAsOfRange("2999-01-01"), /future/);
  assert.throws(() => getAsOfRange("2026-02-31"), /valid date/);
});
