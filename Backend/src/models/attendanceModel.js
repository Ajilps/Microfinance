import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    weekStartDate: {
      type: Date,
      required: [true, "Week start date is required"],
      // Normalized to midnight on Monday by the attendance controller
    },
    attendanceDate: {
      type: Date,
      required: [true, "Attendance date is required"],
      // The actual day admin took attendance (can be any day of the week)
    },
    status: {
      type: String,
      enum: ["present", "absent", "late", "leave"],
      required: [true, "Status is required"],
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    note: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// One attendance record per user per week — prevents duplicates
attendanceSchema.index({ user: 1, weekStartDate: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
