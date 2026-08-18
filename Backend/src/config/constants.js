// Centralized application rules and defaults. These values are deliberately
// version-controlled because changing them changes financial calculations or
// other application behavior; they are not deployment secrets.

export const ATTENDANCE_FINE_AMOUNT = 20;
export const ATTENDANCE_WEEK_START_DAY = 1;

export const LOAN_INTEREST_RATE = 0.01;
export const LOAN_INTEREST_PERIOD_DAYS = 28;
export const LOAN_PERIOD_MATCH_TOLERANCE_MILLISECONDS = 12 * 60 * 60 * 1000;
export const LOAN_SETTLEMENT_TOLERANCE = 0.01;

export const SAVINGS_INTEREST_RATE = 0.001;
export const MINIMUM_TRANSACTION_AMOUNT = 0.01;
export const MINIMUM_SAVINGS_DEPOSIT_AMOUNT = 1;
export const MINIMUM_FINE_PAYMENT_AMOUNT = 1;

export const DASHBOARD_HISTORY_MONTHS = 12;
export const ADMIN_DASHBOARD_HISTORY_MONTHS = 6;
export const ADMIN_DASHBOARD_TOP_MEMBERS_LIMIT = 6;
export const ADMIN_DASHBOARD_ATTENDANCE_WEEKS = 8;
export const ADMIN_DASHBOARD_RECENT_ACTIVITY_LIMIT = 5;
export const INTEREST_AUTOMATION_BATCH_SIZE = 500;
export const DEFAULT_INTEREST_CRON_SCHEDULE = "10 0 * * *";
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

export const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const REPORT_SCOPES = Object.freeze(["monthly", "all"]);
export const ATTENDANCE_CSV_FIELDS = Object.freeze([
  "Name",
  "Email",
  "Total Weeks",
  "Present",
  "Absent",
  "Late",
  "Leave",
  "Fine Owed (INR)",
  "Total Paid (INR)",
  "Balance (INR)",
]);

export const ADMIN_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const ADMIN_PASSWORD_REQUIREMENTS = Object.freeze([
  { test: (value) => value.length >= 8, message: "at least 8 characters" },
  { test: (value) => /[A-Z]/.test(value), message: "one uppercase letter" },
  { test: (value) => /[a-z]/.test(value), message: "one lowercase letter" },
  { test: (value) => /[0-9]/.test(value), message: "one number" },
  {
    test: (value) => /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(value),
    message: "one special character",
  },
]);
