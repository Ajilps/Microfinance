import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateInterestPeriods,
  computeLoanSummary,
} from "../src/controllers/loanController.js";
import {
  buildLoanClosureDocument,
  buildLoanClosurePreview,
} from "../src/services/loanClosureService.js";

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

test("closure settlement charges a partial period and clears both balances", () => {
  const transactions = [
    {
      _id: "loan-1",
      type: "loan",
      amount: 10_000,
      date: new Date("2026-01-01T00:00:00Z"),
    },
    {
      _id: "interest-1",
      type: "interest",
      amount: 100,
      date: new Date("2026-01-29T00:00:00Z"),
      interestPeriod: {
        periodStart: new Date("2026-01-01T00:00:00Z"),
        periodEnd: new Date("2026-01-29T00:00:00Z"),
      },
    },
  ];
  const preview = buildLoanClosurePreview(transactions, "2026-02-12", {
    now: new Date("2026-03-01T00:00:00Z"),
  });

  assert.equal(preview.principalDue, 10_000);
  assert.equal(preview.existingInterestDue, 100);
  assert.equal(preview.projectedPartialInterest, 50);
  assert.equal(preview.totalSettlement, 10_150);

  const closure = buildLoanClosureDocument({
    userId: "member-1",
    closeDate: preview.closeDate,
    preview,
    recordedBy: "admin-1",
  });
  const summary = computeLoanSummary([...transactions, closure]);

  assert.equal(closure.closureDetails.interestCharged, 50);
  assert.equal(closure.closureDetails.interestPaid, 150);
  assert.equal(summary.totalPrincipalRepaid, 10_000);
  assert.equal(summary.totalInterestAccrued, 150);
  assert.equal(summary.totalInterestRepaid, 150);
  assert.equal(summary.principalBalance, 0);
  assert.equal(summary.interestBalance, 0);
  assert.equal(summary.totalOutstanding, 0);
});

test("closure period is recorded and a later loan starts a fresh cycle", () => {
  const firstLoan = {
    _id: "loan-1",
    type: "loan",
    amount: 10_000,
    date: new Date("2026-01-01T00:00:00Z"),
  };
  const preview = buildLoanClosurePreview([firstLoan], "2026-01-15", {
    now: new Date("2026-03-01T00:00:00Z"),
  });
  const closure = {
    _id: "closure-1",
    ...buildLoanClosureDocument({
      userId: "member-1",
      closeDate: preview.closeDate,
      preview,
    }),
  };
  const reopenedLoan = {
    _id: "loan-2",
    type: "loan",
    amount: 5_000,
    date: new Date("2026-02-01T00:00:00Z"),
  };
  const periods = calculateInterestPeriods(
    [firstLoan, closure, reopenedLoan],
    new Date("2026-03-01T00:00:00Z"),
  );

  assert.equal(periods.length, 2);
  assert.equal(periods[0].alreadyRecorded, true);
  assert.equal(periods[0].isPartial, true);
  assert.equal(periods[0].interestAmount, 50);
  assert.equal(
    periods[1].periodStart.toISOString(),
    "2026-02-01T00:00:00.000Z",
  );
  assert.equal(periods[1].isPartial, false);
  assert.equal(periods[1].interestAmount, 50);
});

test("legacy reopened loans keep their established interest calendar until explicitly closed", () => {
  const periods = calculateInterestPeriods(
    [
      {
        type: "loan",
        amount: 1_000,
        date: new Date("2026-01-01T00:00:00Z"),
      },
      {
        type: "repayment",
        paymentTarget: "principal",
        amount: 1_000,
        date: new Date("2026-01-20T00:00:00Z"),
      },
      {
        type: "loan",
        amount: 5_000,
        date: new Date("2026-02-01T00:00:00Z"),
      },
    ],
    new Date("2026-03-26T00:00:00Z"),
  );

  assert.equal(periods.length, 2);
  assert.equal(
    periods[1].periodStart.toISOString(),
    "2026-02-26T00:00:00.000Z",
  );
  assert.equal(periods[1].principalBalance, 5_000);
  assert.equal(periods[1].interestAmount, 50);
});

test("closure preview includes completed interest that has not yet been posted", () => {
  const preview = buildLoanClosurePreview(
    [
      {
        type: "loan",
        amount: 10_000,
        date: new Date("2026-01-01T00:00:00Z"),
      },
    ],
    "2026-02-12",
    { now: new Date("2026-03-01T00:00:00Z") },
  );

  assert.equal(preview.unrecordedCompletedInterest, 100);
  assert.equal(preview.projectedPartialInterest, 50);
  assert.equal(preview.totalInterestDue, 150);
  assert.equal(preview.totalSettlement, 10_150);
});
