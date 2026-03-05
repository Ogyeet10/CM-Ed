import { geolocation } from "@vercel/functions";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  smoothStream,
  stepCountIs,
  streamText,
} from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";
import { auth, type UserType } from "@/app/(auth)/auth";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocument } from "@/lib/ai/tools/create-document";
import { createMacroChart } from "@/lib/ai/tools/create-macro-chart";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { webSearch } from "@/lib/ai/tools/web-search";
import { isProductionEnvironment } from "@/lib/constants";
import { fetchMutation, fetchQuery, getServerSecret } from "@/lib/convex";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

function getStreamContext() {
  try {
    return createResumableStreamContext({ waitUntil: after });
  } catch (_) {
    return null;
  }
}

export { getStreamContext };

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  try {
    const { id, message, messages, selectedChatModel, selectedVisibilityType } =
      requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError("unauthorized:chat").toResponse();
    }

    const serverSecret = getServerSecret();
    const userId = session.user.id as Id<"users">;
    const userType: UserType = session.user.type;

    const messageCount = await fetchQuery(api.messages.countByUser, {
      userId,
      sinceTimestamp: Date.now() - 24 * 60 * 60 * 1000,
      serverSecret,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError("rate_limit:chat").toResponse();
    }

    const isToolApprovalFlow = Boolean(messages);

    const chat = await fetchQuery(api.chats.getByExternalId, {
      externalId: id,
      serverSecret,
    });

    // We need the Convex _id for the chat to save messages
    let chatConvexId: Id<"chats"> | null = chat?._id ?? null;
    let messagesFromDb: Awaited<
      ReturnType<typeof fetchQuery<typeof api.messages.getByChatId>>
    > = [];
    let titlePromise: Promise<string> | null = null;

    if (chat) {
      if (chat.userId !== userId) {
        return new ChatSDKError("forbidden:chat").toResponse();
      }
      if (!isToolApprovalFlow) {
        messagesFromDb = await fetchQuery(api.messages.getByChatId, {
          chatId: chat._id,
          serverSecret,
        });
      }
    } else if (message?.role === "user") {
      chatConvexId = await fetchMutation(api.chats.save, {
        externalId: id,
        userId,
        title: "New chat",
        visibility: selectedVisibilityType,
        serverSecret,
      });
      titlePromise = generateTitleFromUserMessage({ message });
    }

    const uiMessages = isToolApprovalFlow
      ? (messages as ChatMessage[])
      : [...convertToUIMessages(messagesFromDb), message as ChatMessage];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    if (message?.role === "user" && chatConvexId) {
      await fetchMutation(api.messages.save, {
        messages: [
          {
            externalId: message.id,
            chatId: chatConvexId,
            role: "user",
            parts: message.parts,
            attachments: [],
          },
        ],
        serverSecret,
      });
    }

    const isReasoningModel =
      selectedChatModel.includes("reasoning") ||
      selectedChatModel.includes("thinking");

    const modelMessages = await convertToModelMessages(uiMessages);

    const stream = createUIMessageStream({
      originalMessages: isToolApprovalFlow ? uiMessages : undefined,
      execute: async ({ writer: dataStream }) => {
        const result = streamText({
          model: getLanguageModel(selectedChatModel),
          system: systemPrompt({ selectedChatModel, requestHints }),
          messages: modelMessages,
          stopWhen: stepCountIs(5),
          experimental_activeTools: isReasoningModel
            ? []
            : [
                "getWeather",
                "createDocument",
                "updateDocument",
                "requestSuggestions",
                "webSearch",
                "createMacroChart",
              ],
          providerOptions: undefined,
          tools: {
            getWeather,
            createDocument: createDocument({ session, dataStream }),
            updateDocument: updateDocument({ session, dataStream }),
            requestSuggestions: requestSuggestions({ session, dataStream }),
            webSearch,
            createMacroChart: createMacroChart({ session, dataStream }),
          },
          experimental_transform: smoothStream({ chunking: "word" }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: "stream-text",
          },
        });

        dataStream.merge(result.toUIMessageStream({ sendReasoning: true }));

        if (titlePromise && chatConvexId) {
          const title = await titlePromise;
          dataStream.write({ type: "data-chat-title", data: title });
          await fetchMutation(api.chats.updateTitle, {
            id: chatConvexId,
            title,
            serverSecret,
          });
        }
      },
      generateId: generateUUID,
      onFinish: async ({ messages: finishedMessages }) => {
        if (!chatConvexId) {
          return;
        }

        if (isToolApprovalFlow) {
          for (const finishedMsg of finishedMessages) {
            const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
            if (existingMsg) {
              // Look up the existing message by externalId to get Convex _id
              const dbMsg = await fetchQuery(api.messages.getByExternalId, {
                externalId: finishedMsg.id,
                serverSecret,
              });
              if (dbMsg) {
                await fetchMutation(api.messages.update, {
                  id: dbMsg._id,
                  parts: finishedMsg.parts,
                  serverSecret,
                });
              }
            } else {
              await fetchMutation(api.messages.save, {
                messages: [
                  {
                    externalId: finishedMsg.id,
                    chatId: chatConvexId,
                    role: finishedMsg.role,
                    parts: finishedMsg.parts,
                    attachments: [],
                  },
                ],
                serverSecret,
              });
            }
          }
        } else if (finishedMessages.length > 0) {
          await fetchMutation(api.messages.save, {
            messages: finishedMessages.map((currentMessage) => ({
              externalId: currentMessage.id,
              chatId: chatConvexId as Id<"chats">,
              role: currentMessage.role,
              parts: currentMessage.parts,
              attachments: [],
            })),
            serverSecret,
          });
        }
      },
      onError: () => "Oops, an error occurred!",
    });

    return createUIMessageStreamResponse({
      stream,
      async consumeSseStream({ stream: sseStream }) {
        if (!process.env.REDIS_URL) {
          return;
        }
        try {
          const streamContext = getStreamContext();
          if (streamContext && chatConvexId) {
            const streamId = generateId();
            await fetchMutation(api.streams.create, {
              chatId: chatConvexId,
              serverSecret,
            });
            await streamContext.createNewResumableStream(
              streamId,
              () => sseStream
            );
          }
        } catch (_) {
          // ignore redis errors
        }
      },
    });
  } catch (error) {
    const vercelId = request.headers.get("x-vercel-id");

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    if (
      error instanceof Error &&
      error.message?.includes(
        "AI Gateway requires a valid credit card on file to service requests"
      )
    ) {
      return new ChatSDKError("bad_request:activate_gateway").toResponse();
    }

    console.error("Unhandled error in chat API:", error, { vercelId });
    return new ChatSDKError("offline:chat").toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new ChatSDKError("bad_request:api").toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const serverSecret = getServerSecret();
  const chat = await fetchQuery(api.chats.getByExternalId, {
    externalId: id,
    serverSecret,
  });

  if (chat?.userId !== (session.user.id as Id<"users">)) {
    return new ChatSDKError("forbidden:chat").toResponse();
  }

  const deletedChat = await fetchMutation(api.chats.deleteById, {
    id: chat._id,
    serverSecret,
  });

  return Response.json(deletedChat, { status: 200 });
}
