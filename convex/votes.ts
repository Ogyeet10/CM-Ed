import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByChatId = query({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== args.userId) {
      throw new Error("Unauthorized");
    }
    return await ctx.db
      .query("votes")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .collect();
  },
});

export const vote = mutation({
  args: {
    chatId: v.id("chats"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    type: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== args.userId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("votes")
      .withIndex("by_chatId_and_messageId", (q) =>
        q.eq("chatId", args.chatId).eq("messageId", args.messageId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { isUpvoted: args.type === "up" });
    } else {
      await ctx.db.insert("votes", {
        chatId: args.chatId,
        messageId: args.messageId,
        isUpvoted: args.type === "up",
      });
    }
  },
});
