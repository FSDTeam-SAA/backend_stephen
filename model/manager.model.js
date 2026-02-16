import { Schema, model } from "mongoose";

const managerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      sparse: true,
      validator: {
        validator: function (value) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        },
        message: "Invalid email format",
      },
    },
    photo: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const Manager = model("Manager", managerSchema);
