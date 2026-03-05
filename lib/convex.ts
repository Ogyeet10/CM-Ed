import "server-only";

export { fetchMutation, fetchQuery } from "convex/nextjs";

export function getServerSecret(): string {
  const secret = process.env.SERVER_SECRET;
  if (!secret) {
    throw new Error("SERVER_SECRET environment variable is not set");
  }
  return secret;
}
