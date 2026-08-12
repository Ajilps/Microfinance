import mongoose from "mongoose";

const extraTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["income", "expense"],
      required: [true, "Transaction type is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },
    transactionDate: {
      type: Date,
      required: [true, "Transaction date is required"],
    },
    sourceOrReason: {
      type: String,
      required: [true, "Money source or reason is required"],
      trim: true,
      maxlength: [200, "Money source or reason cannot exceed 200 characters"],
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

extraTransactionSchema.index({ transactionDate: -1 });
extraTransactionSchema.index({ type: 1, transactionDate: -1 });

export default mongoose.model("ExtraTransaction", extraTransactionSchema);
