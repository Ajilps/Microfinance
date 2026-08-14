import mongoose from "mongoose";

const bankTransactionSchema = new mongoose.Schema(
  {
    transactionDate: {
      type: Date,
      required: [true, "Transaction date is required"],
    },
    particulars: {
      type: String,
      required: [true, "Particulars are required"],
      trim: true,
      maxlength: [300, "Particulars cannot exceed 300 characters"],
    },
    chequeNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Cheque number cannot exceed 100 characters"],
      default: "",
    },
    chequeName: {
      type: String,
      trim: true,
      maxlength: [200, "Cheque name cannot exceed 200 characters"],
      default: "",
    },
    withdrawal: {
      type: Number,
      min: [0, "Withdrawal cannot be negative"],
      default: 0,
    },
    deposit: {
      type: Number,
      min: [0, "Deposit cannot be negative"],
      default: 0,
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

bankTransactionSchema.pre("validate", function validateMoneyDirection(next) {
  const withdrawal = Number(this.withdrawal || 0);
  const deposit = Number(this.deposit || 0);
  if ((withdrawal > 0 && deposit > 0) || (withdrawal <= 0 && deposit <= 0)) {
    this.invalidate(
      "deposit",
      "Enter either a withdrawal or a deposit, but not both",
    );
  }
  next();
});

bankTransactionSchema.index({ transactionDate: 1, createdAt: 1 });

export default mongoose.model("BankTransaction", bankTransactionSchema);
