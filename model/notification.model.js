import mongoose, { Schema } from "mongoose";
import { getIO } from "../utils/socket.js";

const notificationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },
    update: {
      type: Schema.Types.ObjectId,
      ref: "ProjectUpdate",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        "site_update",
        "new_document",
        "task_assigned",
        "task_approval_needed",
        "task_approved",
        "task_rejected",
        "chat_message",
        "budget_alert",
        "payment_reminder",
      ],
      required: true,
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const emitSocketNotification = (doc) => {
  if (!doc?.user) return;
  try {
    const io = getIO();
    io.to(`user_${doc.user.toString()}`).emit("notification:new", doc);
  } catch (error) {
    // socket may not be initialized
  }
};

notificationSchema.post("save", function (doc) {
  emitSocketNotification(doc);
});

notificationSchema.post("insertMany", function (docs) {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => emitSocketNotification(doc));
});

export const Notification = mongoose.model("Notification", notificationSchema);
