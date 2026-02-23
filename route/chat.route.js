import express from "express";
import {
  getChatMessages,
  getMyChats,
  getOrCreateProjectChat,
  getOrCreateTaskChat,
  markChatAsRead,
  sendMessage,
} from "../controller/chat.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getMyChats);
router.get("/project/:projectId", getOrCreateProjectChat);
router.get("/task/:taskId", getOrCreateTaskChat);
router.get("/:chatId/messages", getChatMessages);
router.post("/:chatId/messages", sendMessage);
router.patch("/:chatId/read", markChatAsRead);

export default router;
