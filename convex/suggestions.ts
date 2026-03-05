import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

export const getByDocumentId = query({
  args: {
    documentId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const suggestions = await ctx.db
      .query("suggestions")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Only return suggestions owned by this user
    return suggestions.filter((s) => s.userId === args.userId);
  },
});

// Server query - get suggestions without auth check (for server actions)
export const getByDocumentIdInternal = query({
  args: { documentId: v.string(), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db
      .query("suggestions")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .collect();
  },
});

export const save = mutation({
  args: {
    suggestions: v.array(
      v.object({
        documentId: v.string(),
        documentCreatedAt: v.number(),
        originalText: v.string(),
        suggestedText: v.string(),
        description: v.optional(v.string()),
        isResolved: v.boolean(),
        userId: v.id("users"),
      })
    ),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    for (const s of args.suggestions) {
      await ctx.db.insert("suggestions", s);
    }
  },
});
