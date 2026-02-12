import { webSearch as exaWebSearch } from "@exalabs/ai-sdk";

export const webSearch = exaWebSearch({
  type: "auto",
  numResults: 6,
  contents: {
    text: { maxCharacters: 1500 },
    livecrawl: "fallback",
    summary: true,
  },
});
