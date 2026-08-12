import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeeklyTransactions,
  getExtraTransactionTotals,
  getWeekRange,
  validateExtraTransaction,
} from "../src/controllers/financeController.js";

test("getWeekRange returns Monday through Sunday for a selected date", () => {
  const { weekStart, weekEnd, weekEndExclusive } = getWeekRange("2026-08-12");

  assert.equal(weekStart.toISOString(), "2026-08-10T00:00:00.000Z");
  assert.equal(weekEnd.toISOString(), "2026-08-16T23:59:59.999Z");
  assert.equal(weekEndExclusive.toISOString(), "2026-08-17T00:00:00.000Z");
});

test("getWeekRange treats Sunday as the final day of the week", () => {
  const { weekStart } = getWeekRange("2026-08-16");
  assert.equal(weekStart.toISOString(), "2026-08-10T00:00:00.000Z");
});

test("validateExtraTransaction requires a positive amount and reason", () => {
  assert.throws(
    () =>
      validateExtraTransaction({
        type: "expense",
        amount: 0,
        transactionDate: "2026-08-12",
        sourceOrReason: "Rent",
      }),
    /greater than 0/,
  );
  assert.throws(
    () =>
      validateExtraTransaction({
        type: "income",
        amount: 100,
        transactionDate: "2026-08-12",
        sourceOrReason: " ",
      }),
    /source or reason is required/,
  );
});

test("extra transaction totals calculate income, expense and balance", () => {
  assert.deepEqual(
    getExtraTransactionTotals([
      { type: "income", amount: 120.25 },
      { type: "income", amount: 30 },
      { type: "expense", amount: 50.1 },
    ]),
    { income: 150.25, expense: 50.1, balance: 100.15 },
  );
});

test("weekly report separates cash movement from accrued charges", () => {
  const report = buildWeeklyTransactions({
    loans: [
      {
        _id: "loan-1",
        type: "loan",
        amount: 1_000,
        date: new Date("2026-08-10T00:00:00Z"),
        user: { name: "Member One" },
        recordedBy: { name: "Admin" },
      },
      {
        _id: "repay-1",
        type: "repayment",
        paymentTarget: "principal",
        amount: 250,
        date: new Date("2026-08-11T00:00:00Z"),
        user: { name: "Member One" },
        recordedBy: { name: "Admin" },
      },
      {
        _id: "interest-1",
        type: "interest",
        amount: 10,
        date: new Date("2026-08-12T00:00:00Z"),
        user: { name: "Member One" },
      },
    ],
    savings: [
      {
        _id: "saving-1",
        amount: 100,
        paidOn: new Date("2026-08-12T00:00:00Z"),
        user: { name: "Member One" },
        recordedBy: { name: "Admin" },
      },
    ],
    finePayments: [
      {
        _id: "fine-payment-1",
        amount: 20,
        paidOn: new Date("2026-08-13T00:00:00Z"),
        user: { name: "Member One" },
        recordedBy: { name: "Admin" },
      },
    ],
    extras: [
      {
        _id: "extra-income-1",
        type: "income",
        amount: 50,
        transactionDate: new Date("2026-08-14T00:00:00Z"),
        sourceOrReason: "Donation",
        recordedBy: { name: "Admin" },
      },
      {
        _id: "extra-expense-1",
        type: "expense",
        amount: 40,
        transactionDate: new Date("2026-08-15T00:00:00Z"),
        sourceOrReason: "Stationery",
        recordedBy: { name: "Admin" },
      },
    ],
  });

  assert.deepEqual(report.totals, {
    cashIncome: 420,
    cashExpense: 1_040,
    nonCashCharges: 10,
    transactionCount: 7,
  });
  assert.deepEqual(report.categoryTotals["Interest accrued"], {
    income: 0,
    expense: 0,
    nonCash: 10,
    total: 10,
  });
});
