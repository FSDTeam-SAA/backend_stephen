import { Schema, model } from "mongoose";

const taskActivitySchema = new Schema(
  {
    action: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
    actedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const taskSchema = new Schema(
  {
    taskName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    taskDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    priority: {
      type: String,
      enum: ["high", "medium", "low"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["not-started", "in-progress", "completed"],
      default: "not-started",
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["not-requested", "pending", "approved", "rejected"],
      default: "not-requested",
      index: true,
    },
    submittedForApprovalAt: {
      type: Date,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    activities: [taskActivitySchema],
  },
  { timestamps: true },
);

taskSchema.index({ project: 1, status: 1, createdAt: -1 });
taskSchema.index({ client: 1, approvalStatus: 1, createdAt: -1 });

taskSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status === "completed") {
    this.approvalStatus = "pending";
    this.submittedForApprovalAt = new Date();
    this.rejectionReason = "";
  }

  if (this.isModified("status") && this.status !== "completed") {
    if (this.approvalStatus === "pending") {
      this.approvalStatus = "not-requested";
      this.submittedForApprovalAt = null;
    }
  }

  next();
});

export const Task = model("Task", taskSchema);
