import { ensureSchema, getPool } from "./db";
import { resolveScopedKey } from "./store";
import type { ScopedKeyScope } from "./control-plane";
import { auth } from "@/auth";

// Three ways to prove you may act on a given database: a browser session
// cookie (the console), the primary full-access Bearer STASHI_API_KEY shown
// in the console's MCP config, or an individually-issued scoped key (see
// scoped_keys table) minted for one agent in a swarm — optionally
// read-only, always revocable on its own, always distinguishable by label
// in the audit log instead of every agent looking identical.
export async function resolveDatabaseAccess(
  request: Request,
  databaseId: string
): Promise<{ email: string; via: "session" | "apiKey"; scope: ScopedKeyScope; keyLabel?: string } | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7).trim();
    if (!apiKey) return null;
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT owner_email FROM databases WHERE id = $1 AND api_key = $2`, [
      databaseId,
      apiKey,
    ]);
    if (rows[0]) return { email: rows[0].owner_email, via: "apiKey", scope: "full" };

    const scoped = await resolveScopedKey(apiKey);
    if (scoped && scoped.databaseId === databaseId) {
      return { email: scoped.email, via: "apiKey", scope: scoped.scope, keyLabel: scoped.label };
    }
    return null;
  }

  const session = await auth();
  const email = session?.user?.email;
  return email ? { email, via: "session", scope: "full" } : null;
}
