import { Schema, model } from "mongoose";

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
    },

    comment: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

export const Comment = model("Comment", updateCommentSchema);
