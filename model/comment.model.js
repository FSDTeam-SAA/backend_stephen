import mongoose, { Schema, model } from "mongoose";

const updateCommentSchema = new Schema(
  {
    update: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProjectUpdate",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

updateCommentSchema.index({ update: 1, createdAt: -1 });

export const Comment = model("Comment", updateCommentSchema);
