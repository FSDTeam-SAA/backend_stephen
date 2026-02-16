import { Schema, model } from "mongoose";

const taskSchema = new Schema(
  {
    taskName: {
      type: String,
      required: true,
      index: true,
    },
    taskDate: {
      type: Date,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
      default: "pending",
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "project",
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

export const Task = model("Task", taskSchema);
