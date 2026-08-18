import mongoose from "mongoose";
import { MINIMUM_TRANSACTION_AMOUNT } from "../config/constants.js";

const savingsWithdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [MINIMUM_TRANSACTION_AMOUNT, "Amount must be greater than 0"],
    },
    withdrawalDate: {
      type: Date,
      required: [true, "Withdrawal date is required"],
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
      maxlength: [300, "Reason cannot exceed 300 characters"],
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "other"],
      default: "cash",
    },
    referenceNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Reference number cannot exceed 100 characters"],
    },
    note: {
      type: String,
      trim: true,
      maxlength: [1000, "Note cannot exceed 1000 characters"],
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

savingsWithdrawalSchema.index({ user: 1, withdrawalDate: -1 });

export default mongoose.model("SavingsWithdrawal", savingsWithdrawalSchema);
