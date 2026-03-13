import mongoose, { Schema } from "mongoose";
import { IOrganization } from "../../types";

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
    },
    subdomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    subscriptionPlan: {
      type: String,
      default: "free",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      loanInterestRate: {
        type: Number,
        default: 10, // 10%
      },
      minSavingsForLoan: {
        type: Number,
        default: 50,
      },
    },
  },
  {
    timestamps: true,
  },
);

const Organization = mongoose.model<IOrganization>("Organization", OrganizationSchema);

export default Organization;
