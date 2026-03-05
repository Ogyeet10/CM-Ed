import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

// Public query - get all versions of a document
export const getByDocumentId = query({
  args: {
    documentId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();

    if (docs.length > 0 && docs[0].userId !== args.userId) {
      throw new Error("Unauthorized");
    }
    return docs;
  },
});

// Public query - get documents by documentId (for preview in chat, no userId needed)
export const getByDocumentIdPublic = query({
  args: { documentId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("asc")
      .collect();
  },
});

// Server query - get latest version (for AI tools)
export const getLatestByDocumentId = query({
  args: { documentId: v.string(), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();
    return docs[0] ?? null;
  },
});

// Server mutation - save document (from AI tools / server-side)
export const save = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet"),
      v.literal("chart")
    ),
    content: v.optional(v.string()),
    userId: v.id("users"),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const id = await ctx.db.insert("documents", {
      documentId: args.documentId,
      title: args.title,
      kind: args.kind,
      content: args.content,
      userId: args.userId,
    });
    return await ctx.db.get(id);
  },
});

// Public mutation - save document from client
export const saveFromClient = mutation({
  args: {
    documentId: v.string(),
    title: v.string(),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet"),
      v.literal("chart")
    ),
    content: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify ownership
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .collect();

    if (existing.length > 0 && existing[0].userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    const id = await ctx.db.insert("documents", {
      documentId: args.documentId,
      title: args.title,
      kind: args.kind,
      content: args.content,
      userId: args.userId,
    });
    return await ctx.db.get(id);
  },
});

// Server mutation - delete versions after timestamp
export const deleteAfterTimestamp = mutation({
  args: {
    documentId: v.string(),
    timestamp: v.number(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    // Delete suggestions for versions after timestamp
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
    for (const s of suggestions) {
      if (s.documentCreatedAt > args.timestamp) {
        await ctx.db.delete(s._id);
      }
    }

    // Delete document versions after timestamp
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
    const deleted: (typeof docs)[number][] = [];
    for (const doc of docs) {
      if (doc._creationTime > args.timestamp) {
        deleted.push(doc);
        await ctx.db.delete(doc._id);
      }
    }
    return deleted;
  },
});
