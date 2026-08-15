import mongoose from "mongoose";

/**
 * SavingsPayment — records each weekly savings deposit for a user.
 *
 * The admin enters:
 *   - amount   → variable amount saved this week
 *   - paidOn   → date the payment was made
 *   - weekStartDate → normalized to start of the week (for deduplication)
 *
 * Derived values (computed in controller):
 *   - totalSavings          = deposits minus savings withdrawals
 *   - savingsInterest       = totalSavings × 0.01 (admin-only view)
 *   - currentWeekPaid       = whether a record exists for current week
 */
const savingsPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    // Normalized start of the week this payment belongs to
    weekStartDate: {
      type: Date,
      required: [true, "Week start date is required"],
    },
    // The actual date the admin records the payment
    paidOn: {
      type: Date,
      required: [true, "Payment date is required"],
    },
    // Variable amount entered by admin for this week
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be at least 1"],
    },
    note: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Admin who recorded this payment
    },
  },
  { timestamps: true }
);

// One savings entry per user per week
savingsPaymentSchema.index({ user: 1, weekStartDate: 1 }, { unique: true });

export default mongoose.model("SavingsPayment", savingsPaymentSchema);
