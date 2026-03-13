import mongoose, { Schema } from "mongoose";
import { IOrganization } from "../../types";

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
<<<<<<< HEAD
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
=======
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
>>>>>>> 6f340881a3ed41c0ad5cf8643de9480131014051
      default: "free",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      loanInterestRate: {
        type: Number,
<<<<<<< HEAD
        default: 10, // 10%
      },
      minSavingsForLoan: {
        type: Number,
        default: 50,
      },
    },
=======
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
>>>>>>> 6f340881a3ed41c0ad5cf8643de9480131014051
  },
  {
    timestamps: true,
  },
);

<<<<<<< HEAD
const Organization = mongoose.model<IOrganization>("Organization", OrganizationSchema);
=======
// Index for fast subdomain lookups
OrganizationSchema.index({ subdomain: 1 }, { unique: true });

const Organization = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
>>>>>>> 6f340881a3ed41c0ad5cf8643de9480131014051

export default Organization;
