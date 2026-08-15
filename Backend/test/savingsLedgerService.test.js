import assert from "node:assert/strict";
import test from "node:test";

import {
  computeSavingsSummary,
  validateSavingsTimeline,
} from "../src/services/savingsLedgerService.js";
import { validateWithdrawalInput } from "../src/controllers/savingsWithdrawalController.js";

test("savings summary subtracts withdrawals from deposits", () => {
  const summary = computeSavingsSummary(
    [{ amount: 500 }, { amount: 250 }],
    [{ amount: 125 }],
  );

  assert.deepEqual(summary, {
    totalDeposits: 750,
    totalWithdrawals: 125,
    totalSavings: 625,
    depositCount: 2,
    withdrawalCount: 1,
    transactionCount: 3,
  });
});

test("savings timeline rejects a withdrawal above the balance available on its date", () => {
  const validation = validateSavingsTimeline(
    [
      { amount: 100, paidOn: new Date("2026-01-10T00:00:00Z") },
      { amount: 500, paidOn: new Date("2026-02-10T00:00:00Z") },
    ],
    [
      {
        amount: 200,
        withdrawalDate: new Date("2026-01-20T00:00:00Z"),
      },
    ],
  );

  assert.equal(validation.valid, false);
  assert.equal(validation.balanceBefore, 100);
  assert.equal(validation.shortage, 100);
});

test("withdrawal input requires a date, reason, method, and positive amount", () => {
  const values = validateWithdrawalInput({
    amount: "250.50",
    withdrawalDate: "2026-08-12",
    reason: " Medical costs ",
    paymentMethod: "bank",
    referenceNumber: " TX-42 ",
    note: " Approved by member ",
  });

  assert.equal(values.amount, 250.5);
  assert.equal(values.reason, "Medical costs");
  assert.equal(values.paymentMethod, "bank");
  assert.equal(values.referenceNumber, "TX-42");
  assert.throws(
    () =>
      validateWithdrawalInput({
        amount: 10,
        withdrawalDate: "2026-08-12",
        reason: " ",
      }),
    /reason is required/,
  );
});
