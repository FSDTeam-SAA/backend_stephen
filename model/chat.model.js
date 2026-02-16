import { Schema, model } from "mongoose";

const chatSchema = new Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    entityType: {
      type: String,
      enum: ["Task", "ProjectUpdate"],
      required: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    lastMessage: String,
    lastMessageAt: Date,
  },
  { timestamps: true },
);

chatSchema.index({ entityId: 1, entityType: 1 });

export const Chat = model("Chat", chatSchema);
