import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBankLedger,
  validateBankTransaction,
} from "../src/controllers/bankTransactionController.js";

test("bank transaction requires exactly one money direction", () => {
  const base = {
    transactionDate: "2026-08-14",
    particulars: "Bank entry",
  };

  assert.throws(
    () => validateBankTransaction({ ...base, withdrawal: 0, deposit: 0 }),
    /either a withdrawal or a deposit/i,
  );
  assert.throws(
    () => validateBankTransaction({ ...base, withdrawal: 50, deposit: 100 }),
    /either a withdrawal or a deposit/i,
  );
});

test("bank transaction trims fields and normalizes money", () => {
  const result = validateBankTransaction({
    transactionDate: "2026-08-14",
    particulars: "  Cash deposit  ",
    chequeNumber: "  10024 ",
    chequeName: "  Member One ",
    withdrawal: "",
    deposit: "125.456",
  });

  assert.equal(result.particulars, "Cash deposit");
  assert.equal(result.chequeNumber, "10024");
  assert.equal(result.chequeName, "Member One");
  assert.equal(result.withdrawal, 0);
  assert.equal(result.deposit, 125.46);
});

test("bank ledger calculates a running balance in chronological order", () => {
  const result = buildBankLedger([
    { _id: "one", deposit: 1_000, withdrawal: 0 },
    { _id: "two", deposit: 0, withdrawal: 250.25 },
    { _id: "three", deposit: 50, withdrawal: 0 },
  ]);

  assert.deepEqual(
    result.entries.map((entry) => entry.balance),
    [1_000, 749.75, 799.75],
  );
  assert.deepEqual(result.totals, {
    totalDeposits: 1_050,
    totalWithdrawals: 250.25,
    currentBalance: 799.75,
  });
});
