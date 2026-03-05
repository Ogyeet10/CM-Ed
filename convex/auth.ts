/**
 * Server secret validation for Convex functions called from the Next.js server.
 *
 * Functions that should only be callable from the server (not directly from clients)
 * accept a `serverSecret` parameter and validate it against the SERVER_SECRET env var.
 */
export function requireServerSecret(serverSecret: string | undefined) {
  const expected = process.env.SERVER_SECRET;
  if (!expected) {
    throw new Error("SERVER_SECRET environment variable is not configured");
  }
  if (!serverSecret || serverSecret !== expected) {
    throw new Error("Unauthorized: invalid server secret");
  }
}
