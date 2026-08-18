import cron from "node-cron";
import { applyDueInterestForAllUsers } from "../services/interestAutomationService.js";
import {
  DEFAULT_INTEREST_CRON_SCHEDULE,
  DEFAULT_TIME_ZONE,
} from "../config/constants.js";

let activeRun = null;
let scheduledTask = null;
const automationState = {
  enabled: false,
  running: false,
  schedule: DEFAULT_INTEREST_CRON_SCHEDULE,
  timezone: DEFAULT_TIME_ZONE,
  runOnStartup: true,
  lastTrigger: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastResult: null,
  lastError: null,
};

const enabledBy = (value, defaultValue = true) => {
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() !== "false";
};

const getInterestAutomationConfig = (environment = process.env) => {
  const requestedSchedule =
    environment.INTEREST_CRON_SCHEDULE || DEFAULT_INTEREST_CRON_SCHEDULE;
  const schedule = cron.validate(requestedSchedule)
    ? requestedSchedule
    : DEFAULT_INTEREST_CRON_SCHEDULE;

  return {
    enabled: enabledBy(environment.INTEREST_CRON_ENABLED),
    runOnStartup: enabledBy(environment.INTEREST_CRON_RUN_ON_STARTUP),
    schedule,
    requestedSchedule,
    timezone: environment.INTEREST_CRON_TIMEZONE || DEFAULT_TIME_ZONE,
  };
};

const getInterestAutomationStatus = () => ({
  ...automationState,
  nextRunAt: scheduledTask?.getNextRun?.() || null,
});

const runInterestAutomation = async ({
  trigger = "scheduled",
  toDate = new Date(),
} = {}) => {
  if (activeRun) {
    return {
      skipped: true,
      reason: "An interest automation run is already in progress",
    };
  }

  automationState.running = true;
  automationState.lastTrigger = trigger;
  automationState.lastStartedAt = new Date();
  automationState.lastError = null;

  activeRun = applyDueInterestForAllUsers({ toDate });
  try {
    const result = await activeRun;
    automationState.lastResult = result;
    automationState.lastCompletedAt = new Date();
    return { skipped: false, ...result };
  } catch (error) {
    automationState.lastError = error.message;
    automationState.lastCompletedAt = new Date();
    throw error;
  } finally {
    automationState.running = false;
    activeRun = null;
  }
};

const logAutomationResult = (trigger, result) => {
  if (result.skipped) {
    console.log(`[InterestAutomation] ${trigger} run skipped: ${result.reason}`);
    return;
  }
  console.log(
    `[InterestAutomation] ${trigger}: scanned ${result.usersScanned} member ledger(s), found ${result.duePeriodsFound} due period(s), applied ${result.periodsApplied} (${result.totalApplied.toFixed(2)})`,
  );
};

const executeAndLog = async (trigger) => {
  try {
    const result = await runInterestAutomation({ trigger });
    logAutomationResult(trigger, result);
  } catch (error) {
    console.error(`[InterestAutomation] ${trigger} run failed:`, error.message);
  }
};

const startInterestCron = () => {
  const config = getInterestAutomationConfig();
  Object.assign(automationState, {
    enabled: config.enabled,
    schedule: config.schedule,
    timezone: config.timezone,
    runOnStartup: config.runOnStartup,
  });

  if (!config.enabled) {
    console.log("Automatic interest scheduler disabled");
    return null;
  }

  if (config.requestedSchedule !== config.schedule) {
    console.warn(
      `[InterestAutomation] Invalid INTEREST_CRON_SCHEDULE "${config.requestedSchedule}"; using ${config.schedule}`,
    );
  }

  scheduledTask?.stop();
  scheduledTask = cron.schedule(
    config.schedule,
    () => executeAndLog("scheduled"),
    {
      timezone: config.timezone,
      noOverlap: true,
      name: "microfinance-interest-automation",
    },
  );

  console.log(
    `Automatic interest scheduler started (${config.schedule}, ${config.timezone})`,
  );

  // A deployment may sleep or restart at the scheduled time. This catch-up run
  // makes startup safe: atomic period upserts make it a no-op when already done.
  if (config.runOnStartup) void executeAndLog("startup");

  return scheduledTask;
};

const stopInterestCron = () => {
  scheduledTask?.stop();
  scheduledTask = null;
  automationState.enabled = false;
};

export {
  getInterestAutomationConfig,
  getInterestAutomationStatus,
  runInterestAutomation,
  startInterestCron,
  stopInterestCron,
};
