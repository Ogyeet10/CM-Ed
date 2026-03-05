import { Output, streamText, tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchMutation, fetchQuery, getServerSecret } from "@/lib/convex";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import { getArtifactModel } from "../providers";

type RequestSuggestionsProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const requestSuggestions = ({
  session,
  dataStream,
}: RequestSuggestionsProps) =>
  tool({
    description:
      "Request writing suggestions for an existing document artifact. Only use this when the user explicitly asks to improve or get suggestions for a document they have already created. Never use for general questions.",
    inputSchema: z.object({
      documentId: z
        .string()
        .describe(
          "The UUID of an existing document artifact that was previously created with createDocument"
        ),
    }),
    execute: async ({ documentId }) => {
      const serverSecret = getServerSecret();
      const document = await fetchQuery(api.documents.getLatestByDocumentId, {
        documentId,
        serverSecret,
      });

      if (!document || !document.content) {
        return {
          error: "Document not found",
        };
      }

      const suggestions: Array<{
        originalText: string;
        suggestedText: string;
        description: string;
        id: string;
        documentId: string;
        isResolved: boolean;
      }> = [];

      const { partialOutputStream } = streamText({
        model: getArtifactModel(),
        system:
          "You are a help writing assistant. Given a piece of writing, please offer suggestions to improve the piece of writing and describe the change. It is very important for the edits to contain full sentences instead of just words. Max 5 suggestions.",
        prompt: document.content,
        output: Output.array({
          element: z.object({
            originalSentence: z.string().describe("The original sentence"),
            suggestedSentence: z.string().describe("The suggested sentence"),
            description: z
              .string()
              .describe("The description of the suggestion"),
          }),
        }),
      });

      let processedCount = 0;
      for await (const partialOutput of partialOutputStream) {
        if (!partialOutput) {
          continue;
        }

        for (let i = processedCount; i < partialOutput.length; i++) {
          const element = partialOutput[i];
          if (
            !element?.originalSentence ||
            !element?.suggestedSentence ||
            !element?.description
          ) {
            continue;
          }

          const suggestion = {
            originalText: element.originalSentence,
            suggestedText: element.suggestedSentence,
            description: element.description,
            id: generateUUID(),
            documentId,
            isResolved: false,
          };

          dataStream.write({
            type: "data-suggestion",
            data: suggestion,
            transient: true,
          });

          suggestions.push(suggestion);
          processedCount++;
        }
      }

      if (session.user?.id) {
        const userId = session.user.id as Id<"users">;

        await fetchMutation(api.suggestions.save, {
          suggestions: suggestions.map((s) => ({
            documentId: s.documentId,
            documentCreatedAt: document._creationTime,
            originalText: s.originalText,
            suggestedText: s.suggestedText,
            description: s.description,
            isResolved: s.isResolved,
            userId,
          })),
          serverSecret,
        });
      }

      return {
        id: documentId,
        title: document.title,
        kind: document.kind,
        message: "Suggestions have been added to the document",
      };
    },
  });
