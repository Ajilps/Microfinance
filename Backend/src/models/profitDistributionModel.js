import mongoose from "mongoose";
import { MINIMUM_TRANSACTION_AMOUNT } from "../config/constants.js";

const profitAllocationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "", trim: true },
    savingsBalance: { type: Number, required: true, min: 0 },
    sharePercent: { type: Number, required: true, min: 0, max: 100 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const profitDistributionSchema = new mongoose.Schema(
  {
    asOfDate: {
      type: Date,
      required: true,
    },
    distributionDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [
        MINIMUM_TRANSACTION_AMOUNT,
        "Distribution amount must be greater than 0",
      ],
    },
    // Identifies the exact calculation state used for this payout. The active
    // partial unique index prevents duplicate submissions while allowing a
    // reversed allocation to be created again later if needed.
    calculationKey: {
      type: String,
      trim: true,
    },
    totalSavings: {
      type: Number,
      required: true,
      min: 0,
    },
    allocations: {
      type: [profitAllocationSchema],
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "At least one member allocation is required",
      },
    },
    summarySnapshot: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [1000, "Note cannot exceed 1000 characters"],
      default: "",
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "reversed"],
      default: "active",
      required: true,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reversalReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Un-allocation reason cannot exceed 1000 characters"],
      default: "",
    },
    unallocationLocked: {
      type: Boolean,
      default: false,
      required: true,
    },
    unallocationLockedAt: {
      type: Date,
      default: null,
    },
    unallocationLockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

profitDistributionSchema.index({ distributionDate: -1, createdAt: -1 });
profitDistributionSchema.index({ "allocations.user": 1, distributionDate: -1 });
profitDistributionSchema.index(
  { calculationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      calculationKey: { $type: "string" },
      status: "active",
    },
  },
);

export default mongoose.model("ProfitDistribution", profitDistributionSchema);
