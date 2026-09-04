import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { recordUserSeen } from "@/lib/store";

// JWT-only sessions (no database adapter) on purpose: every table in this
// app already keys off the user's plain email address (databases.owner_email,
// activity.owner_email, scoped_keys.owner_email, users.email as PK) — an
// adapter's own accounts/sessions schema would use a separate UUID user id
// and force a migration through all of that. Auth.js still does the real
// work here (verifying the OAuth flow with GitHub/Google, signing the
// session cookie so it can't be edited client-side the way the old raw
// stashi_session cookie could) — it just doesn't own a users table of its
// own. The email Auth.js verifies IS the identity the rest of the app uses.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub, Google],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await recordUserSeen(user.email);
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) token.email = user.email;
      return token;
    },
    async session({ session, token }) {
      if (token.email) session.user.email = token.email as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
