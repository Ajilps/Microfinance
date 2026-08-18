import test from "node:test";
import assert from "node:assert/strict";

import { getWeekRange } from "../src/controllers/attendanceController.js";

test("attendance uses Monday as the canonical start for both admin flows", () => {
  const { start, end } = getWeekRange(new Date(2026, 7, 18, 12));

  assert.deepEqual(
    [start.getFullYear(), start.getMonth(), start.getDate(), start.getDay()],
    [2026, 7, 17, 1],
  );
  assert.deepEqual(
    [end.getFullYear(), end.getMonth(), end.getDate(), end.getDay()],
    [2026, 7, 24, 1],
  );
});

test("Sunday attendance remains in the week that began the previous Monday", () => {
  const { start, end } = getWeekRange(new Date(2026, 7, 23, 12));

  assert.equal(start.getDate(), 17);
  assert.equal(end.getDate(), 24);
});
