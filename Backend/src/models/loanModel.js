import mongoose from "mongoose";

/**
 * LoanTransaction — audit log of all loan-related events for a user.
 *
 * Types:
 *   loan        → new loan disbursed to user (increases principal balance)
 *   repayment   → user paid back money (decreases principal OR interest balance)
 *   interest    → 1% of PRINCIPAL recorded every 28 days (never added to principal)
 *   fine        → optional penalty added by admin (increases interest balance)
 *
 * Key design principle:
 *   - Principal balance = sum(loan) - sum(repayment where paymentTarget='principal')
 *   - Interest balance  = sum(interest) + sum(fine) - sum(repayment where paymentTarget='interest')
 *   - Interest is ALWAYS calculated on the original principal, never capitalized.
 */
const loanTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    type: {
      type: String,
      enum: ["loan", "repayment", "interest", "fine"],
      required: [true, "Transaction type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    // For repayment transactions: specifies whether payment reduces principal or interest
    paymentTarget: {
      type: String,
      enum: ["principal", "interest", null],
      default: null,
    },
    // The date the transaction is recorded as happening (admin-controlled)
    date: {
      type: Date,
      required: [true, "Transaction date is required"],
    },
    // For interest transactions: metadata about the period this interest covers
    interestPeriod: {
      periodStart: { type: Date, default: null },
      periodEnd: { type: Date, default: null },
      principalBalance: { type: Number, default: null },
      interestRate: { type: Number, default: 0.01 }, // 1% default
    },
    note: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who entered this record
    },
  },
  { timestamps: true },
);

// Index for fast per-user queries
loanTransactionSchema.index({ user: 1, date: -1 });
loanTransactionSchema.index({ user: 1, type: 1 });

// ─── Idempotency index ─────────────────────────────────────────────────────────
// Prevents duplicate interest records for the exact same period.
// The index is sparse so it only applies to documents where
// interestPeriod.periodStart is set (i.e. interest-type transactions with
// a real period). Non-interest transactions and lump-sum entries that have
// periodStart=null are excluded and remain unconstrained.
//
// Effect: a second attempt to INSERT an interest transaction for the same
// (user, periodStart) will throw a duplicate-key error (code 11000), which
// all relevant controller functions catch and convert to a 409 response.
loanTransactionSchema.index(
  { user: 1, "interestPeriod.periodStart": 1 },
  {
    unique: true,
    sparse: true,   // null / missing periodStart values are NOT indexed → no conflict
    name: "unique_interest_period_per_user",
    // partialFilterExpression is a stronger alternative to sparse when supported,
    // but sparse is universally compatible with MongoDB 4+.
  },
);

export default mongoose.model("LoanTransaction", loanTransactionSchema);
