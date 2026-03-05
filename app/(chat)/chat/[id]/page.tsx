import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";

export default async function Page(_props: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/api/auth/guest");
  }

  // ChatShell in chat/layout.tsx handles all rendering.
  // This page exists only for the server-side auth gate.
  return null;
}
