import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInterestUpsertOperation,
  collectDueInterestEntries,
  persistInterestEntries,
} from "../src/services/interestAutomationService.js";
import { getInterestAutomationConfig } from "../src/utils/interestCron.js";

const baseLedger = [
  {
    _id: "loan-1",
    user: "member-1",
    type: "loan",
    amount: 10_000,
    date: new Date("2026-01-01T00:00:00.000Z"),
  },
];

test("interest automation plans only completed unrecorded periods", () => {
  const toDate = new Date("2026-02-26T00:00:00.000Z");
  const firstRun = collectDueInterestEntries(baseLedger, toDate);

  assert.equal(firstRun.length, 2);
  assert.equal(firstRun[0].document.amount, 100);
  assert.equal(firstRun[0].document.entrySource, "automatic");
  assert.equal(
    firstRun[0].document.date.getTime(),
    firstRun[0].period.periodEnd.getTime(),
  );

  const ledgerAfterFirstRun = [
    ...baseLedger,
    ...firstRun.map((entry, index) => ({
      _id: `interest-${index}`,
      ...entry.document,
    })),
  ];
  const repeatedRun = collectDueInterestEntries(ledgerAfterFirstRun, toDate);
  assert.equal(repeatedRun.length, 0);
});

test("interest automation uses atomic set-on-insert upserts", () => {
  const [entry] = collectDueInterestEntries(
    baseLedger,
    new Date("2026-01-29T00:00:00.000Z"),
  );
  const operation = buildInterestUpsertOperation(entry);

  assert.equal(operation.updateOne.upsert, true);
  assert.equal(operation.updateOne.filter.user, "member-1");
  assert.equal(operation.updateOne.filter.type, "interest");
  assert.equal(
    operation.updateOne.filter["interestPeriod.periodStart"].getTime(),
    new Date("2026-01-01T00:00:00.000Z").getTime(),
  );
  assert.deepEqual(operation.updateOne.update.$setOnInsert, entry.document);
});

test("interest persistence reports only database-created periods", async () => {
  const entries = collectDueInterestEntries(
    baseLedger,
    new Date("2026-02-26T00:00:00.000Z"),
  );
  const calls = [];
  const loanModel = {
    bulkWrite: async (operations, options) => {
      calls.push({ operations, options });
      return {
        upsertedCount: 1,
        upsertedIds: { 1: "created-interest-id" },
      };
    },
  };

  const result = await persistInterestEntries(entries, { loanModel });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.ordered, false);
  assert.equal(result.periodsApplied, 1);
  assert.equal(result.totalApplied, entries[1].period.interestAmount);
});

test("interest automation configuration supports disabling and safe fallback", () => {
  const disabled = getInterestAutomationConfig({
    INTEREST_CRON_ENABLED: "false",
    INTEREST_CRON_RUN_ON_STARTUP: "false",
    INTEREST_CRON_SCHEDULE: "not a cron expression",
    INTEREST_CRON_TIMEZONE: "UTC",
  });

  assert.equal(disabled.enabled, false);
  assert.equal(disabled.runOnStartup, false);
  assert.equal(disabled.schedule, "10 0 * * *");
  assert.equal(disabled.timezone, "UTC");
});
