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

const projectImageSchema = new Schema(
  {
    public_id: { type: String, default: "" },
    url: { type: String, required: true },
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
    images: [projectImageSchema],
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
    clientUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

projectSchema.index({ siteManager: 1, projectStatus: 1, createdAt: -1 });
projectSchema.index({ client: 1, createdAt: -1 });
projectSchema.index({ clientUsers: 1, createdAt: -1 });
projectSchema.index({ projectName: "text", address: "text", clientName: "text" });

projectSchema.virtual("totalDays").get(function () {
  if (!this.startDate || !this.endDate) {
    return 0;
  }

  const diffMs = new Date(this.endDate).getTime() - new Date(this.startDate).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) {
    return 0;
  }

  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
});

projectSchema.virtual("elapsedDays").get(function () {
  const totalDays = this.totalDays || 0;
  if (!totalDays || !this.startDate) {
    return 0;
  }

  const today = new Date();
  const startDate = new Date(this.startDate);

  if (today < startDate) {
    return 0;
  }

  const elapsedMs = today.getTime() - startDate.getTime();
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(elapsedDays, totalDays);
});

projectSchema.virtual("remainingDays").get(function () {
  const totalDays = this.totalDays || 0;
  const elapsedDays = this.elapsedDays || 0;
  return Math.max(totalDays - elapsedDays, 0);
});

projectSchema.virtual("dayProgress").get(function () {
  return `${this.elapsedDays || 0}/${this.totalDays || 0}`;
});

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
    ...((this.clientUsers || []).map((clientId) => clientId?.toString())),
  ].filter(Boolean);
  this.members = [...new Set(participantIds)];

  if ((!this.clientUsers || this.clientUsers.length === 0) && this.client) {
    this.clientUsers = [this.client];
  }

  if (!this.client && this.clientUsers?.length > 0) {
    this.client = this.clientUsers[0];
  }

  next();
});

export const Project = model("Project", projectSchema);
