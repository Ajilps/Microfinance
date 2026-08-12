import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateInterestPeriods,
  computeLoanSummary,
} from "../src/controllers/loanController.js";

test("computeLoanSummary keeps principal and interest balances separate", () => {
  const transactions = [
    { type: "loan", amount: 10_000 },
    { type: "interest", amount: 100 },
    { type: "fine", amount: 20 },
    { type: "repayment", paymentTarget: "interest", amount: 50 },
    { type: "repayment", paymentTarget: "principal", amount: 1_500 },
  ];

  assert.deepEqual(computeLoanSummary(transactions), {
    totalDisbursed: 10_000,
    totalPrincipalRepaid: 1_500,
    totalInterestAccrued: 100,
    totalFines: 20,
    totalInterestRepaid: 50,
    principalBalance: 8_500,
    interestBalance: 70,
    totalOutstanding: 8_570,
  });
});

test("calculateInterestPeriods separates completed and partial periods", () => {
  const transactions = [
    { type: "loan", amount: 10_000, date: new Date("2026-01-01T00:00:00Z") },
  ];

  const periods = calculateInterestPeriods(
    transactions,
    new Date("2026-02-12T00:00:00Z"),
  );

  assert.equal(periods.length, 2);
  assert.equal(periods[0].daysInPeriod, 28);
  assert.equal(periods[0].isPartial, false);
  assert.equal(periods[0].interestAmount, 100);
  assert.equal(periods[1].daysInPeriod, 14);
  assert.equal(periods[1].isPartial, true);
  assert.equal(periods[1].interestAmount, 50);
});

test("principal repayment changes interest for the next period only", () => {
  const transactions = [
    { type: "loan", amount: 10_000, date: new Date("2026-01-01T00:00:00Z") },
    {
      type: "repayment",
      paymentTarget: "principal",
      amount: 2_000,
      date: new Date("2026-01-20T00:00:00Z"),
    },
  ];

  const periods = calculateInterestPeriods(
    transactions,
    new Date("2026-02-26T00:00:00Z"),
  );

  assert.equal(periods[0].principalBalance, 10_000);
  assert.equal(periods[0].interestAmount, 100);
  assert.equal(periods[1].principalBalance, 8_000);
  assert.equal(periods[1].interestAmount, 80);
});
