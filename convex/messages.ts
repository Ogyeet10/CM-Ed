import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

// Public query - get messages by chatId with userId-based auth (client-side)
export const getByChatIdPublic = query({
  args: { chatId: v.id("chats"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify chat ownership / visibility
    const chat = await ctx.db.get(args.chatId);
    if (!chat) {
      return [];
    }
    if (chat.visibility === "private" && chat.userId !== args.userId) {
      return [];
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

// Server query - get messages by chatId (requires serverSecret)
export const getByChatId = query({
  args: { chatId: v.id("chats"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
  },
});

export const getByExternalId = query({
  args: { externalId: v.string(), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db
      .query("messages")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .unique();
  },
});

export const getById = query({
  args: { id: v.id("messages"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db.get(args.id);
  },
});

export const save = mutation({
  args: {
    messages: v.array(
      v.object({
        externalId: v.string(),
        chatId: v.id("chats"),
        role: v.string(),
        parts: v.any(),
        attachments: v.any(),
      })
    ),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const ids: string[] = [];
    for (const msg of args.messages) {
      const id = await ctx.db.insert("messages", {
        externalId: msg.externalId,
        chatId: msg.chatId,
        role: msg.role,
        parts: msg.parts,
        attachments: msg.attachments,
      });
      ids.push(id);
    }
    return ids;
  },
});

export const update = mutation({
  args: {
    id: v.id("messages"),
    parts: v.any(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    await ctx.db.patch(args.id, { parts: args.parts });
  },
});

export const deleteAfterTimestamp = mutation({
  args: {
    chatId: v.id("chats"),
    timestamp: v.number(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();

    const toDelete = messages.filter((m) => m._creationTime >= args.timestamp);

    // Delete associated votes first
    for (const msg of toDelete) {
      const votes = await ctx.db
        .query("votes")
        .withIndex("by_messageId", (q) => q.eq("messageId", msg._id))
        .collect();
      for (const vote of votes) {
        await ctx.db.delete(vote._id);
      }
    }

    // Delete messages
    for (const msg of toDelete) {
      await ctx.db.delete(msg._id);
    }
  },
});

export const countByUser = query({
  args: {
    userId: v.id("users"),
    sinceTimestamp: v.number(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const chats = await ctx.db
      .query("chats")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    let count = 0;
    for (const chat of chats) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chatId", (q) => q.eq("chatId", chat._id))
        .collect();
      count += messages.filter(
        (m) => m.role === "user" && m._creationTime >= args.sinceTimestamp
      ).length;
    }
    return count;
  },
});
