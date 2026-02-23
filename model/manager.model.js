import { Schema, model } from "mongoose";

const managerSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    designation: { type: String, trim: true, default: "Site Manager" },
    totalProjects: { type: Number, default: 0 },
    activeProjects: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Manager = model("Manager", managerSchema);
