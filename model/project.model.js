import { Schema, model } from "mongoose";

const projectSchema = new Schema(
  {
    clientName: {
      type: String,
      required: true,
      index: true,
    },
    projectName: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["construction", "interior"],
      required: true,
      index: true,
    },
    phases: [
      {
        phaseName: {
          type: String,
          required: true,
        },
        amount: {
          type: String,
          required: true,
        },
        paymentDate: {
          type: Date,
          required: true,
        },
      },
    ],
    projectBudget: {
      type: String,
      required: true,
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
      enum: ["inProgress", "completed"],
      required: true,
    },
    siteManager: {
      type: Schema.Types.ObjectId,
      ref: "Manager",
      required: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export const Project = model("Project", projectSchema);
