"use client";

import { createContext, useContext, useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

type UserContextValue = {
  userId: Id<"users"> | null;
};

const UserContext = createContext<UserContextValue>({ userId: null });

export function UserProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ userId: userId as Id<"users"> | null }),
    [userId]
  );
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
