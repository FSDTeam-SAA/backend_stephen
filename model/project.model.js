import { Schema, model } from "mongoose";

const phaseSchema = new Schema(
  {
    phaseName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "unpaid",
      index: true,
    },
    paidAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const progressUpdateSchema = new Schema(
  {
    progressName: { type: String, required: true, trim: true },
    percent: { type: Number, min: 0, max: 100, required: true },
    note: { type: String, trim: true, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const projectSchema = new Schema(
  {
    projectCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    clientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["construction", "interior"],
      required: true,
      index: true,
    },
    phases: [phaseSchema],
    projectBudget: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    remainingBudget: {
      type: Number,
      default: 0,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    projectStatus: {
      type: String,
      enum: ["active", "finished"],
      default: "active",
      index: true,
    },
    siteManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    progressUpdates: [progressUpdateSchema],
    lastProgressUpdateAt: {
      type: Date,
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

projectSchema.index({ siteManager: 1, projectStatus: 1, createdAt: -1 });
projectSchema.index({ client: 1, createdAt: -1 });
projectSchema.index({ projectName: "text", address: "text", clientName: "text" });

projectSchema.pre("validate", function (next) {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    return next(new Error("End date must be greater than start date"));
  }

  if (Array.isArray(this.progressUpdates) && this.progressUpdates.length > 0) {
    const latest = this.progressUpdates[this.progressUpdates.length - 1];
    this.progress = latest.percent;
    this.lastProgressUpdateAt = latest.updatedAt;
  }

  next();
});

projectSchema.pre("save", function (next) {
  this.totalPaid = (this.phases || [])
    .filter((phase) => phase.paymentStatus === "paid")
    .reduce((sum, phase) => sum + Number(phase.amount || 0), 0);

  this.remainingBudget = Math.max(
    Number(this.projectBudget || 0) - Number(this.totalPaid || 0),
    0,
  );

  const participantIds = [
    this.createdBy?.toString(),
    this.siteManager?.toString(),
    this.client?.toString(),
  ].filter(Boolean);
  this.members = [...new Set(participantIds)];

  next();
});

export const Project = model("Project", projectSchema);
