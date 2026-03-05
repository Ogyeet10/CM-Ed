"use server";

import { auth } from "@/app/(auth)/auth";
import { api } from "@/convex/_generated/api";
import { fetchQuery, getServerSecret } from "@/lib/convex";
import { toSuggestionShape } from "@/lib/types/convex";

export async function getSuggestions({ documentId }: { documentId: string }) {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const serverSecret = getServerSecret();
  const suggestions = await fetchQuery(
    api.suggestions.getByDocumentIdInternal,
    { documentId, serverSecret }
  );
  return (suggestions ?? []).map(toSuggestionShape);
}
