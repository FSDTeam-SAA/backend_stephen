import { Chat } from "../model/chat.model.js";

const normalizeParticipantIds = (participants = []) =>
  [...new Set(participants.filter(Boolean).map((id) => id.toString()))];

export const ensureChatRoom = async ({
  entityId,
  entityType,
  participants,
  createdBy,
  title = "",
}) => {
  const normalizedParticipants = normalizeParticipantIds(participants);
  const normalizedTitle = String(title || "").trim();

  let chat = await Chat.findOne({ entityId, entityType });
  if (chat) {
    const existingParticipants = normalizeParticipantIds(chat.participants || []);
    const mergedParticipants = [
      ...new Set([...existingParticipants, ...normalizedParticipants]),
    ];

    let shouldSave = false;

    if (mergedParticipants.length !== existingParticipants.length) {
      chat.participants = mergedParticipants;
      shouldSave = true;
    }

    if (normalizedTitle && chat.title !== normalizedTitle) {
      chat.title = normalizedTitle;
      shouldSave = true;
    }

    if (shouldSave) {
      await chat.save();
    }

    return chat;
  }

  chat = await Chat.create({
    entityId,
    entityType,
    participants: normalizedParticipants,
    createdBy,
    title: normalizedTitle,
  });

  return chat;
};
