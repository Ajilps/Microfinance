import mongoose, { Schema } from "mongoose";
import { IOrganization } from "../../types";

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    subdomain: {
      type: String,
      required: [true, "Subdomain is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-z0-9-]+$/,
        "Subdomain can only contain lowercase letters, numbers, and hyphens",
      ],
    },
    subscriptionPlan: {
      type: String,
      enum: ["free", "basic", "premium", "enterprise"],
      default: "free",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      loanInterestRate: {
        type: Number,
        default: 5.0,
        min: [0, "Interest rate cannot be negative"],
        max: [100, "Interest rate cannot exceed 100%"],
      },
      minSavingsForLoan: {
        type: Number,
        default: 1000,
        min: [0, "Minimum savings cannot be negative"],
      },
    },
    // Owner reference — the user who created the organization
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  },
);

// Index for fast subdomain lookups
OrganizationSchema.index({ subdomain: 1 }, { unique: true });

const Organization = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);

export default Organization;
