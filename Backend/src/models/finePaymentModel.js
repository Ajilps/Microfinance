import mongoose from "mongoose";
import { MINIMUM_FINE_PAYMENT_AMOUNT } from "../config/constants.js";

const finePaymentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"],
        },
        amount: {
            type: Number,
            required: [true, "Payment amount is required"],
            min: [
                MINIMUM_FINE_PAYMENT_AMOUNT,
                `Amount must be at least ₹${MINIMUM_FINE_PAYMENT_AMOUNT}`,
            ],
        },
        month: {
            type: Number,
            required: [true, "Month is required"],
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: [true, "Year is required"],
        },
        paidOn: {
            type: Date,
            default: Date.now,
        },
        recordedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Admin who recorded this payment
        },
        note: {
            type: String,
            trim: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("FinePayment", finePaymentSchema);
