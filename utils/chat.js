import { Chat } from "../model/chat.model.js";

export const ensureChatRoom = async ({
  entityId,
  entityType,
  participants,
  createdBy,
  title = "",
}) => {
  let chat = await Chat.findOne({ entityId, entityType });
  if (chat) {
    return chat;
  }

  chat = await Chat.create({
    entityId,
    entityType,
    participants,
    createdBy,
    title,
  });

  return chat;
};
