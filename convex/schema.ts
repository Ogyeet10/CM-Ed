import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    password: v.optional(v.string()),
  }).index("by_email", ["email"]),

  chats: defineTable({
    externalId: v.string(),
    title: v.string(),
    userId: v.id("users"),
    visibility: v.union(v.literal("public"), v.literal("private")),
  })
    .index("by_userId", ["userId"])
    .index("by_externalId", ["externalId"]),

  messages: defineTable({
    externalId: v.string(),
    chatId: v.id("chats"),
    role: v.string(),
    parts: v.any(),
    attachments: v.any(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_externalId", ["externalId"]),

  votes: defineTable({
    chatId: v.id("chats"),
    messageId: v.id("messages"),
    isUpvoted: v.boolean(),
  })
    .index("by_chatId", ["chatId"])
    .index("by_messageId", ["messageId"])
    .index("by_chatId_and_messageId", ["chatId", "messageId"]),

  documents: defineTable({
    documentId: v.string(),
    title: v.string(),
    content: v.optional(v.string()),
    kind: v.union(
      v.literal("text"),
      v.literal("code"),
      v.literal("image"),
      v.literal("sheet"),
      v.literal("chart")
    ),
    userId: v.id("users"),
  })
    .index("by_documentId", ["documentId"])
    .index("by_userId", ["userId"]),

  suggestions: defineTable({
    documentId: v.string(),
    documentCreatedAt: v.number(),
    originalText: v.string(),
    suggestedText: v.string(),
    description: v.optional(v.string()),
    isResolved: v.boolean(),
    userId: v.id("users"),
  }).index("by_documentId", ["documentId"]),

  streams: defineTable({
    chatId: v.id("chats"),
  }).index("by_chatId", ["chatId"]),
});
