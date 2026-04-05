import mongoose from "mongoose";

/**
 * AuditLog — immutable audit trail for destructive admin actions.
 *
 * Every hard-delete of a loan transaction or savings payment produces one record.
 * Fields are write-once: no update path is provided by any controller.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Who performed the action
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adminName: { type: String, default: "" },

    // What was done
    action: {
      type: String,
      enum: ["DELETE_LOAN_TRANSACTION", "DELETE_SAVINGS_PAYMENT"],
      required: true,
    },

    // The account/user the record belonged to
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The ID of the deleted document (stored as string since it no longer exists)
    deletedRecordId: { type: String, required: true },

    // Snapshot of the deleted record's key fields
    deletedRecord: {
      type: { type: String },
      amount: Number,
      date: Date,
      note: String,
      paymentTarget: String,     // loan transactions only
      interestPeriod: mongoose.Schema.Types.Mixed, // loan transactions only
    },

    // Balances as computed immediately before and after the deletion
    summaryBefore: { type: mongoose.Schema.Types.Mixed, default: null },
    summaryAfter:  { type: mongoose.Schema.Types.Mixed, default: null },

    // Optional reason supplied by the admin
    reason: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true, // createdAt = when the deletion happened
    // Prevent any modifications after creation
    strict: true,
  },
);

// Index for fast per-user audit queries and action filtering
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
