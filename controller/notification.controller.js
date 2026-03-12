import httpStatus from "http-status";
import { Notification } from "../model/notification.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { getIO } from "../utils/socket.js";

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getMyNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(200);

  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(todayStart.getDate() - 1);

  const grouped = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  for (const item of notifications) {
    const created = new Date(item.createdAt);
    if (created >= todayStart) {
      grouped.today.push(item);
    } else if (created >= yesterdayStart && created < todayStart) {
      grouped.yesterday.push(item);
    } else {
      grouped.earlier.push(item);
    }
  }

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notifications fetched",
    data: {
      unreadCount,
      grouped,
    },
  });
});

export const markNotificationRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: req.user._id },
    { isRead: true, readAt: new Date() },
    { new: true },
  );

  if (notification) {
    try {
      const io = getIO();
      io.to(`user_${req.user._id}`).emit("notification:read", {
        notificationId: notification._id,
        readAt: notification.readAt,
      });
    } catch (error) {
      // socket may not be initialized
    }
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Notification marked as read",
    data: null,
  });
});

export const markAllNotificationsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() },
  );

  try {
    const io = getIO();
    io.to(`user_${req.user._id}`).emit("notification:readAll", {
      userId: req.user._id,
      at: new Date(),
    });
  } catch (error) {
    // socket may not be initialized
  }

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All notifications marked as read",
    data: null,
  });
});
