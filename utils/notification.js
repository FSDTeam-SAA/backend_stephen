import { Notification } from "../model/notification.model.js";

export const createNotification = async (payload) => {
  const notification = await Notification.create(payload);
  return notification;
};

export const createNotificationsForUsers = async (userIds, buildPayload) => {
  const uniqueUserIds = [
    ...new Set(
      (userIds || [])
        .filter(Boolean)
        .map((userId) => userId.toString()),
    ),
  ];

  return Promise.all(
    uniqueUserIds.map((userId) =>
      createNotification(buildPayload(userId)),
    ),
  );
};
