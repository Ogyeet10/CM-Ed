import { createDocumentHandler } from "@/lib/artifacts/server";

/**
 * Chart document handler.
 * Chart creation is handled directly by the `createMacroChart` tool,
 * which fetches FRED data and saves to Convex itself.
 * This handler exists to satisfy the DocumentHandler registry and support
 * future update operations.
 */
export const chartDocumentHandler = createDocumentHandler<"chart">({
  kind: "chart",
  onCreateDocument: async ({ title }) => {
    // Fallback — in practice charts are created by the createMacroChart tool
    return JSON.stringify({
      title,
      seriesId: "",
      units: "",
      frequency: "",
      observations: [],
    });
  },
  onUpdateDocument: async ({ document, dataStream }) => {
    const content = document.content ?? "{}";

    dataStream.write({
      type: "data-chartDelta",
      data: content,
      transient: true,
    });

    return content;
  },
});
