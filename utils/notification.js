import { Notification } from "../model/notification.model.js";
import { getIO } from "./socket.js";

export const createNotification = async (payload) => {
  const notification = await Notification.create(payload);

  try {
    const io = getIO();
    io.to(`user_${payload.user.toString()}`).emit(
      "notification:new",
      notification,
    );
  } catch (error) {
    console.error("Error emitting notification via Socket.IO:", error);
  }

  return notification;
};
