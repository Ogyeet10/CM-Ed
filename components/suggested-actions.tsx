"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { memo } from "react";
import type { ChatMessage } from "@/lib/types";
import { Suggestion } from "./elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestedActions = [
    {
      prompt: "Explain the CME Group market structure.",
      label: "EXPLAIN THE CME GROUP MARKET STRUCTURE",
    },
    {
      prompt: "What are futures contracts?",
      label: "WHAT ARE FUTURES CONTRACTS?",
    },
    {
      prompt:
        "Show me a chart of the Federal Funds Rate over the last 5 years and explain what I am seeing.",
      label: "SHOW FED FUNDS RATE CHART + EXPLAIN",
    },
    {
      prompt:
        "Show me a chart of WTI crude oil prices and explain why it matters for NYMEX crude oil futures.",
      label: "CHART WTI FOR NYMEX FUTURES",
    },
  ];

  return (
    <div
      className="grid w-full gap-3 sm:grid-cols-2"
      data-testid="suggested-actions"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          initial={{ opacity: 0, x: -20 }}
          key={suggestedAction.prompt}
          transition={{ delay: 0.1 * index }}
        >
          <Suggestion
            className="h-auto w-full whitespace-normal border-2 border-foreground bg-background p-4 font-mono text-left text-xs uppercase tracking-wider shadow-[3px_3px_0px_var(--brutalist-accent)] transition-all duration-150 hover:bg-accent hover:shadow-[4px_4px_0px_var(--brutalist-accent)] hover:translate-x-[-1px] hover:translate-y-[-1px] active:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
            onClick={() => {
              window.history.pushState({}, "", `/chat/${chatId}`);
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestedAction.prompt }],
              });
            }}
            suggestion={suggestedAction.prompt}
          >
            <span className="text-primary">&gt;</span> {suggestedAction.label}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
