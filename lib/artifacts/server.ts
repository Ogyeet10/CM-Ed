import type { UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { chartDocumentHandler } from "@/artifacts/chart/server";
import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
import type { ArtifactKind } from "@/components/artifact";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { fetchMutation, getServerSecret } from "../convex";
import type { ChatMessage } from "../types";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

export type UpdateDocumentCallbackProps = {
  document: {
    id: string;
    documentId?: string;
    title: string;
    content?: string | null;
    kind: string;
    createdAt: Date;
  };
  description: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  session: Session;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        const serverSecret = getServerSecret();
        await fetchMutation(api.documents.save, {
          documentId: args.id,
          title: args.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id as Id<"users">,
          serverSecret,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        session: args.session,
      });

      if (args.session?.user?.id) {
        const serverSecret = getServerSecret();
        const docId = args.document.documentId ?? args.document.id;
        await fetchMutation(api.documents.save, {
          documentId: docId,
          title: args.document.title,
          content: draftContent,
          kind: config.kind,
          userId: args.session.user.id as Id<"users">,
          serverSecret,
        });
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
  chartDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
