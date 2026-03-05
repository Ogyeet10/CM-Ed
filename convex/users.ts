import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerSecret } from "./auth";

export const getByEmail = query({
  args: { email: v.string(), serverSecret: v.optional(v.string()) },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
  },
});

export const create = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    return await ctx.db.insert("users", {
      email: args.email,
      password: args.password,
    });
  },
});

export const createGuest = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    serverSecret: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireServerSecret(args.serverSecret);
    const id = await ctx.db.insert("users", {
      email: args.email,
      password: args.password,
    });
    const user = await ctx.db.get(id);
    return user;
  },
});
