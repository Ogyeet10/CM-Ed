import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { api } from "@/convex/_generated/api";
import { generateHashedPassword } from "@/lib/auth-utils";
import { DUMMY_PASSWORD } from "@/lib/constants";
import { fetchMutation, fetchQuery, getServerSecret } from "@/lib/convex";
import { generateUUID } from "@/lib/utils";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const serverSecret = getServerSecret();
        const users = await fetchQuery(api.users.getByEmail, {
          email,
          serverSecret,
        });

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return { id: user._id, email: user.email, type: "regular" };
      },
    }),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        const serverSecret = getServerSecret();
        const email = `guest-${Date.now()}`;
        const password = generateHashedPassword(generateUUID());

        const guestUser = await fetchMutation(api.users.createGuest, {
          email,
          password,
          serverSecret,
        });

        // biome-ignore lint: Forbidden non-null assertion.
        return { id: guestUser!._id, email: guestUser!.email, type: "guest" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
      }

      // Invalidate old pre-Convex sessions that have UUID-format IDs.
      // Convex IDs never contain dashes; UUIDs always do.
      if (token.id?.includes("-")) {
        token.id = "";
        token.type = undefined as unknown as UserType;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});
