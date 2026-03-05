import type { Doc } from "@/convex/_generated/dataModel";

// Re-export Convex document types with the old names for compatibility
export type User = Doc<"users">;
export type Chat = Doc<"chats"> & { id: string; createdAt: Date };
export type Vote = Doc<"votes">;
export type Document = Doc<"documents"> & { id: string; createdAt: Date };
// Suggestion type that works for both DB results and streaming data
export type Suggestion = {
  id: string;
  documentId: string;
  originalText: string;
  suggestedText: string;
  description?: string;
  isResolved: boolean;
  // Fields only present on DB results
  _id?: string;
  _creationTime?: number;
  userId?: string;
  documentCreatedAt?: number;
};
export type DBMessage = Doc<"messages"> & { id: string; createdAt: Date };
export type Stream = Doc<"streams">;

// Helper to convert Convex chat doc to legacy shape
export function toChatShape(doc: Doc<"chats">): Chat {
  return {
    ...doc,
    id: doc.externalId,
    createdAt: new Date(doc._creationTime),
  };
}

// Helper to convert Convex message doc to legacy shape
export function toMessageShape(doc: Doc<"messages">): DBMessage {
  return {
    ...doc,
    id: doc.externalId,
    createdAt: new Date(doc._creationTime),
  };
}

// Helper to convert Convex document doc to legacy shape
export function toDocumentShape(doc: Doc<"documents">): Document {
  return {
    ...doc,
    id: doc.documentId,
    createdAt: new Date(doc._creationTime),
  };
}

// Helper to convert Convex suggestion doc to Suggestion shape
export function toSuggestionShape(doc: Doc<"suggestions">): Suggestion {
  return {
    ...doc,
    id: doc._id,
  };
}
