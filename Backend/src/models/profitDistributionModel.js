import mongoose from "mongoose";

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
      min: [0.01, "Distribution amount must be greater than 0"],
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
  },
  { timestamps: true },
);

profitDistributionSchema.index({ distributionDate: -1, createdAt: -1 });
profitDistributionSchema.index({ "allocations.user": 1, distributionDate: -1 });

export default mongoose.model("ProfitDistribution", profitDistributionSchema);
