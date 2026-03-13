// Curated list of top models from Vercel AI Gateway
export const DEFAULT_CHAT_MODEL = "google/gemini-3.1-flash-lite-preview";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  // OpenAI
  {
    id: "openai/gpt-4.1-mini",
    name: "GPT-4.1 Mini",
    provider: "openai",
    description: "Fast and cost-effective for simple tasks",
  },
  // Google
  {
    id: "google/gemini-3.1-flash-lite-preview",
    name: "Gemini 3.1 Flash-Lite Preview",
    provider: "google",
    description: "Ultra fast and cost-efficient for high-volume tasks",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash Lite",
    provider: "google",
    description: "Ultra fast and affordable",
  },
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
