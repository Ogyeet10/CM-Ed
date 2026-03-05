"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useQuery } from "convex/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { ChatSDKError } from "@/lib/errors";
import type { Attachment, ChatMessage } from "@/lib/types";
import {
  convertToUIMessages,
  fetchWithErrorHandlers,
  generateUUID,
} from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { DataStreamHandler } from "./data-stream-handler";
import { useDataStream } from "./data-stream-provider";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { toast } from "./toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { useUser } from "./user-provider";
import type { VisibilityType } from "./visibility-selector";

function getChatModelFromCookie(): string {
  if (typeof document === "undefined") {
    return DEFAULT_CHAT_MODEL;
  }
  const match = document.cookie.match(/(?:^|;\s*)chat-model=([^;]*)/);
  if (match) {
    return decodeURIComponent(match[1]);
  }
  return DEFAULT_CHAT_MODEL;
}

export function ChatShell() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { userId } = useUser();
  const router = useRouter();

  // ── Convex reactive data ──────────────────────────────────────────
  const chat = useQuery(
    api.chats.getByExternalIdPublic,
    userId && id ? { externalId: id, userId } : "skip"
  );

  const messagesFromDb = useQuery(
    api.messages.getByChatIdPublic,
    chat?._id && userId ? { chatId: chat._id, userId } : "skip"
  );

  // ── Derived state ─────────────────────────────────────────────────
  // Optimistic: while chat is loading (undefined), assume not readonly so the
  // visibility selector and input box stay mounted and don't flash.
  // Only go readonly when the query has resolved to null or a non-owned chat.
  const isReadonly =
    !userId || chat === null || (chat !== undefined && chat.userId !== userId);
  const chatVisibility: VisibilityType = chat?.visibility ?? "private";

  // Redirect if chat not found / unauthorized (null means resolved but missing)
  useEffect(() => {
    if (chat === null && userId) {
      router.push("/");
    }
  }, [chat, userId, router]);

  // ── Client-side model from cookie ─────────────────────────────────
  const [currentModelId, setCurrentModelId] = useState(getChatModelFromCookie);
  const currentModelIdRef = useRef(currentModelId);
  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  // ── Visibility ────────────────────────────────────────────────────
  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType: chatVisibility,
  });

  // ── Data stream (shared with DataStreamHandler) ───────────────────
  const { setDataStream } = useDataStream();

  // ── Local UI state ────────────────────────────────────────────────
  const [input, setInput] = useState("");
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  // ── useChat ───────────────────────────────────────────────────────
  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
    addToolApprovalResponse,
  } = useChat<ChatMessage>({
    id,
    messages: [],
    generateId: generateUUID,
    sendAutomaticallyWhen: ({ messages: currentMessages }) => {
      const lastMessage = currentMessages.at(-1);
      return (
        lastMessage?.parts?.some(
          (part) =>
            "state" in part &&
            part.state === "approval-responded" &&
            "approval" in part &&
            (part.approval as { approved?: boolean })?.approved === true
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        const lastMessage = request.messages.at(-1);
        const isToolApprovalContinuation =
          lastMessage?.role !== "user" ||
          request.messages.some((msg) =>
            msg.parts?.some((part) => {
              const state = (part as { state?: string }).state;
              return (
                state === "approval-responded" || state === "output-denied"
              );
            })
          );

        return {
          body: {
            id: request.id,
            ...(isToolApprovalContinuation
              ? { messages: request.messages }
              : { message: lastMessage }),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
    },
    onFinish: () => {
      // Sidebar auto-updates via Convex reactive query
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({ type: "error", description: error.message });
        }
      }
    },
  });

  // ── Sync Convex messages → useChat (once per chat navigation) ─────
  const syncedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (syncedForIdRef.current === id) {
      return;
    }
    if (!messagesFromDb) {
      return;
    }

    syncedForIdRef.current = id;
    const msgs = convertToUIMessages(messagesFromDb);
    setMessages(msgs);

    // Auto-resume if last message was from user (interrupted stream)
    const lastMsg = messagesFromDb.at(-1);
    if (lastMsg?.role === "user") {
      resumeStream();
    }
  }, [id, messagesFromDb, setMessages, resumeStream]);

  // ── Handle data-appendMessage for auto-resume ─────────────────────
  const { dataStream } = useDataStream();

  useEffect(() => {
    if (!dataStream?.length) {
      return;
    }
    const dataPart = dataStream[0];
    if (dataPart.type === "data-appendMessage") {
      const message = JSON.parse(dataPart.data);
      const currentMsgs = messagesFromDb
        ? convertToUIMessages(messagesFromDb)
        : [];
      setMessages([...currentMsgs, message]);
    }
  }, [dataStream, messagesFromDb, setMessages]);

  // ── ?query= deep-link handling ────────────────────────────────────
  const searchParams = useSearchParams();
  const query = searchParams.get("query");
  const appendedQueryForIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (query && appendedQueryForIdRef.current !== id) {
      appendedQueryForIdRef.current = id;
      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: query }],
      });
      window.history.replaceState({}, "", `/chat/${id}`);
    }
  }, [query, sendMessage, id]);

  // ── Browser back/forward ──────────────────────────────────────────
  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // ── Votes (TODO: implement reactive votes) ────────────────────────
  const votes = undefined;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <div className="overscroll-behavior-contain relative flex h-dvh min-w-0 touch-pan-y flex-col bg-background">
        <ChatHeader
          chatId={id}
          isReadonly={isReadonly}
          selectedVisibilityType={chatVisibility}
        />

        <Messages
          addToolApprovalResponse={addToolApprovalResponse}
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={messages}
          regenerate={regenerate}
          selectedModelId={currentModelId}
          setMessages={setMessages}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4">
          {!isReadonly && (
            <MultimodalInput
              attachments={attachments}
              chatId={id}
              input={input}
              messages={messages}
              onModelChange={setCurrentModelId}
              selectedModelId={currentModelId}
              selectedVisibilityType={visibilityType}
              sendMessage={sendMessage}
              setAttachments={setAttachments}
              setInput={setInput}
              setMessages={setMessages}
              showSuggestions={false}
              status={status}
              stop={stop}
            />
          )}
        </div>
      </div>

      <Artifact
        addToolApprovalResponse={addToolApprovalResponse}
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        regenerate={regenerate}
        selectedModelId={currentModelId}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DataStreamHandler />
    </>
  );
}
