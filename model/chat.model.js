import mongoose, { Schema, model } from "mongoose";

const lastMessageSchema = new Schema(
  {
    message: { type: String, default: "" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const chatSchema = new Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    entityType: {
      type: String,
      enum: ["Task", "Project"],
      required: true,
      index: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, trim: true, default: "" },
    lastMessage: lastMessageSchema,
  },
  { timestamps: true },
);

chatSchema.index({ entityId: 1, entityType: 1 }, { unique: true });
chatSchema.index({ participants: 1, updatedAt: -1 });

export const Chat = model("Chat", chatSchema);
