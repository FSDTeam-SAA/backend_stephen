import { Notification } from "../model/notification.model.js";

export const createNotification = async (payload) => {
  const notification = await Notification.create(payload);
  return notification;
};
