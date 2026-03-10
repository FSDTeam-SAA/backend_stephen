import httpStatus from "http-status";
import AppError from "../errors/AppError.js";
import { Chat } from "../model/chat.model.js";
import { Message } from "../model/message.model.js";
import { Task } from "../model/task.model.js";
import catchAsync from "../utils/catchAsync.js";
import sendResponse from "../utils/sendResponse.js";
import { ensureChatRoom } from "../utils/chat.js";
import { getProjectForUser } from "../utils/projectAccess.js";
import { getIO } from "../utils/socket.js";
import { createNotification } from "../utils/notification.js";

const assertUserInChat = (chat, userId) => {
  const isParticipant = chat.participants.some((id) => id.toString() === userId.toString());
  if (!isParticipant) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not a participant of this chat");
  }
};

export const getMyChats = catchAsync(async (req, res) => {
  const { entityType } = req.query;
  const query = { participants: req.user._id };

  if (entityType) {
    query.entityType = entityType;
  }

  const chats = await Chat.find(query)
    .populate("participants", "name email avatar role")
    .sort({ updatedAt: -1 });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Chats fetched",
    data: chats,
  });
});

export const getOrCreateTaskChat = catchAsync(async (req, res) => {
  const { taskId } = req.params;
  const task = await Task.findById(taskId);
  if (!task) {
    throw new AppError(httpStatus.NOT_FOUND, "Task not found");
  }

  const isAllowed =
    task.manager.toString() === req.user._id.toString() ||
    task.client.toString() === req.user._id.toString();

  if (!isAllowed) {
    throw new AppError(httpStatus.FORBIDDEN, "You cannot access this task chat");
  }

  const chat = await ensureChatRoom({
    entityId: task._id,
    entityType: "Task",
    participants: [task.manager, task.client, req.user._id],
    createdBy: task.manager,
    title: `${task.taskName} Discussion`,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Task chat ready",
    data: chat,
  });
});

export const getOrCreateProjectChat = catchAsync(async (req, res) => {
  const { projectId } = req.params;
  const project = await getProjectForUser(projectId, req.user);

  const chat = await ensureChatRoom({
    entityId: project._id,
    entityType: "Project",
    participants: [
      project.createdBy,
      project.siteManager,
      project.client,
      req.user._id,
    ],
    createdBy: project.createdBy,
    title: `${project.projectName} Group Chat`,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Project group chat ready",
    data: chat,
  });
});

export const getChatMessages = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const page = Math.max(Number(req.query.page || 1), 1);
  const skip = (page - 1) * limit;

  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, "Chat not found");
  }
  assertUserInChat(chat, req.user._id);

  const messages = await Message.find({ chatRoom: chat._id })
    .populate("sender", "name avatar role")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Messages fetched",
    data: messages.reverse(),
  });
});

export const sendMessage = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const { message } = req.body;
  const trimmedMessage = String(message || "").trim();

  if (!trimmedMessage) {
    throw new AppError(httpStatus.BAD_REQUEST, "Message is required");
  }

  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, "Chat not found");
  }
  assertUserInChat(chat, req.user._id);

  const newMessage = await Message.create({
    chatRoom: chat._id,
    sender: req.user._id,
    message: trimmedMessage,
  });

  chat.lastMessage = {
    message: trimmedMessage,
    sender: req.user._id,
    at: new Date(),
  };
  await chat.save();

  const populatedMessage = await Message.findById(newMessage._id).populate(
    "sender",
    "name avatar role",
  );

  const io = getIO();
  io.to(`chat_${chat._id}`).emit("chat:message", populatedMessage);

  const recipients = chat.participants.filter(
    (id) => id.toString() !== req.user._id.toString(),
  );

  await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        user: recipientId,
        chat: chat._id,
        title: "New Message",
        message: `${req.user.name}: ${trimmedMessage.substring(0, 120)}`,
        type: "chat_message",
      }),
    ),
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Message sent",
    data: populatedMessage,
  });
});

export const markChatAsRead = catchAsync(async (req, res) => {
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId);
  if (!chat) {
    throw new AppError(httpStatus.NOT_FOUND, "Chat not found");
  }
  assertUserInChat(chat, req.user._id);

  await Message.updateMany(
    {
      chatRoom: chat._id,
      sender: { $ne: req.user._id },
      isRead: false,
    },
    {
      $set: { isRead: true },
      $addToSet: { readBy: { user: req.user._id, at: new Date() } },
    },
  );

  const io = getIO();
  io.to(`chat_${chat._id}`).emit("chat:read", {
    chatId: chat._id,
    userId: req.user._id,
    at: new Date(),
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Chat marked as read",
    data: null,
  });
});
