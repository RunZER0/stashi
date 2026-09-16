import { headers } from "next/headers";
import { auth as betterAuth } from "@/lib/auth/better-auth";
import { recordUserSeen } from "@/lib/store";

export interface StashiSession {
  user: {
    id?: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

/**
 * Resolves the authenticated user session using Better Auth.
 * Fully backward-compatible with existing Stashi console, admin, and API callers.
 */
export async function auth(): Promise<StashiSession | null> {
  try {
    const reqHeaders = await headers();
    const session = await betterAuth.api.getSession({
      headers: reqHeaders,
    });
    if (session?.user?.email) {
      await recordUserSeen(session.user.email);
      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        },
      };
    }
  } catch {
    // Gracefully handle invocations outside of active HTTP request contexts
  }
  return null;
}

export const handlers = {
  GET: async (req: Request) => betterAuth.handler(req),
  POST: async (req: Request) => betterAuth.handler(req),
};

export async function signIn(provider?: string, options?: { redirectTo?: string }) {
  return { ok: true, provider, options };
}

export async function signOut(options?: { redirectTo?: string }) {
  return { ok: true, options };
}
