import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

// Public query - used from sidebar via usePaginatedQuery
export const listByUser = query({
  args: {
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// Public query - lookup by external UUID with userId-based auth (client-side)
export const getByExternalIdPublic = query({
  args: { externalId: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (!chat) {
      return null;
    }

    // Public chats visible to anyone; private chats require ownership
    if (chat.visibility === "private" && chat.userId !== args.userId) {
      return null;
    }

    return chat;
  },
});

// Server query - lookup by external UUID
export const getByExternalId = query({
  args: { externalId: v.string(), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db
      .query("chats")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

// Server query - lookup by Convex ID
export const getById = query({
  args: { id: v.id("chats"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db.get(args.id);
  },
});

// Server mutation - create chat
export const save = mutation({
  args: {
    externalId: v.string(),
    title: v.string(),
    userId: v.id("users"),
    visibility: v.union(v.literal("public"), v.literal("private")),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db.insert("chats", {
      externalId: args.externalId,
      title: args.title,
      userId: args.userId,
      visibility: args.visibility,
    });
  },
});

// Server mutation - update title
export const updateTitle = mutation({
  args: {
    id: v.id("chats"),
    title: v.string(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    await ctx.db.patch(args.id, { title: args.title });
  },
});

// Public mutation - update visibility (called from client)
export const updateVisibility = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
    visibility: v.union(v.literal("public"), v.literal("private")),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== args.userId) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch(args.chatId, { visibility: args.visibility });
  },
});

// Server mutation - update visibility (from server action)
export const updateVisibilityInternal = mutation({
  args: {
    id: v.id("chats"),
    visibility: v.union(v.literal("public"), v.literal("private")),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    await ctx.db.patch(args.id, { visibility: args.visibility });
  },
});

// Server mutation - cascade delete by Convex ID
export const deleteById = mutation({
  args: { id: v.id("chats"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);

    // Delete votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const v of votes) {
      await ctx.db.delete(v._id);
    }

    // Delete messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete streams
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.id))
      .collect();
    for (const s of streams) {
      await ctx.db.delete(s._id);
    }

    // Delete chat
    const chat = await ctx.db.get(args.id);
    if (chat) {
      await ctx.db.delete(args.id);
    }
    return chat;
  },
});

// Public mutation - delete by external ID with ownership check
export const deleteByExternalId = mutation({
  args: {
    externalId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db
      .query("chats")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();

    if (!chat || chat.userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    // Delete votes
    const votes = await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();
    for (const v of votes) {
      await ctx.db.delete(v._id);
    }

    // Delete messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete streams
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
      .collect();
    for (const s of streams) {
      await ctx.db.delete(s._id);
    }

    await ctx.db.delete(chat._id);
    return chat;
  },
});

// Server mutation - delete all chats for a user
export const deleteAllByUser = mutation({
  args: { userId: v.id("users"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    let count = 0;
    for (const chat of chats) {
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
        .collect();
      for (const v of votes) {
        await ctx.db.delete(v._id);
      }

      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
        .collect();
      for (const m of messages) {
        await ctx.db.delete(m._id);
      }

      const streams = await ctx.db
        .query("streams")
        .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
        .collect();
      for (const s of streams) {
        await ctx.db.delete(s._id);
      }

      await ctx.db.delete(chat._id);
      count++;
    }
    return { deletedCount: count };
  },
});
