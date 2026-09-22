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
      try {
        await recordUserSeen(session.user.email);
      } catch (err) {
        console.warn("[Stashi Auth] Non-blocking warning recording user seen:", err);
      }
      return {
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          image: session.user.image,
        },
      };
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("[Stashi Auth] Error resolving session:", err);
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
