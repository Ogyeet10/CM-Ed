import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

export const create = mutation({
  args: { chatId: v.id("chats"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db.insert("streams", { chatId: args.chatId });
  },
});

export const getByChatId = query({
  args: { chatId: v.id("chats"), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const streams = await ctx.db
      .query("streams")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .order("asc")
      .collect();
    return streams.map((s) => s._id);
  },
});
