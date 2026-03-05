"use server";

import { generateText, type UIMessage } from "ai";
import { cookies } from "next/headers";
import type { VisibilityType } from "@/components/visibility-selector";
import { api } from "@/convex/_generated/api";
import { titlePrompt } from "@/lib/ai/prompts";
import { getTitleModel } from "@/lib/ai/providers";
import { fetchMutation, fetchQuery, getServerSecret } from "@/lib/convex";
import { getTextFromMessage } from "@/lib/utils";

export async function saveChatModelAsCookie(model: string) {
  const cookieStore = await cookies();
  cookieStore.set("chat-model", model);
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text } = await generateText({
    model: getTitleModel(),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });
  return text
    .replace(/^[#*"\s]+/, "")
    .replace(/["]+$/, "")
    .trim();
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const serverSecret = getServerSecret();
  const message = await fetchQuery(api.messages.getByExternalId, {
    externalId: id,
    serverSecret,
  });

  if (!message) {
    return;
  }

  await fetchMutation(api.messages.deleteAfterTimestamp, {
    chatId: message.chatId,
    timestamp: message._creationTime,
    serverSecret,
  });
}

export async function updateChatVisibility({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const serverSecret = getServerSecret();
  const chat = await fetchQuery(api.chats.getByExternalId, {
    externalId: chatId,
    serverSecret,
  });

  if (!chat) {
    return;
  }

  await fetchMutation(api.chats.updateVisibilityInternal, {
    id: chat._id,
    visibility,
    serverSecret,
  });
}
