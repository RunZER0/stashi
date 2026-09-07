import { ensureSchema, getPool } from "./db";
import { resolveScopedKey, resolveAccountKey } from "./store";
import type { ScopedKeyScope } from "./control-plane";
import { auth } from "@/auth";

function bearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}

// Four ways to prove you may act on a given database: a browser session
// cookie (the console), the primary full-access Bearer STASHI_API_KEY shown
// in the console's MCP config, an individually-issued scoped key (see
// scoped_keys table) minted for one agent in a swarm, or an account-level
// key (see account_keys table) valid across every database the caller
// owns. An account key's scope carries through unchanged — a read-only
// account key is still read-only against any individual database it
// touches, same as a read-only per-database key.
export async function resolveDatabaseAccess(
  request: Request,
  databaseId: string
): Promise<{ email: string; via: "session" | "apiKey"; scope: ScopedKeyScope; keyLabel?: string } | null> {
  const apiKey = bearerToken(request);
  if (apiKey) {
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

    const account = await resolveAccountKey(apiKey);
    if (account) {
      const owns = await getPool().query(`SELECT 1 FROM databases WHERE id = $1 AND owner_email = $2`, [
        databaseId,
        account.email,
      ]);
      if (owns.rows[0]) return { email: account.email, via: "apiKey", scope: account.scope, keyLabel: account.label };
    }

    return null;
  }

  const session = await auth();
  const email = session?.user?.email;
  return email ? { email, via: "session", scope: "full" } : null;
}

// For account-scoped routes (list/create databases, manage account keys) --
// a session, or an account-level key itself. A database-scoped key
// (primary or scoped) is deliberately NOT accepted here: it has no
// business listing or touching databases other than the one it's already
// scoped to, and account-key creation from a database-scoped key would be
// real privilege escalation (unlike a full key minting a same-database
// scoped key, which can only ever hand out a subset of access it already
// has).
export async function resolveAccountAccess(
  request: Request
): Promise<{ email: string; via: "session" | "apiKey"; scope: ScopedKeyScope; keyLabel?: string } | null> {
  const apiKey = bearerToken(request);
  if (apiKey) {
    const account = await resolveAccountKey(apiKey);
    return account ? { email: account.email, via: "apiKey", scope: account.scope, keyLabel: account.label } : null;
  }

  const session = await auth();
  const email = session?.user?.email;
  return email ? { email, via: "session", scope: "full" } : null;
}

export type ApiKeyAccess =
  | { kind: "database"; email: string; databaseId: string; scope: ScopedKeyScope; keyLabel?: string }
  | { kind: "account"; email: string; scope: ScopedKeyScope; keyLabel: string };

// Same key paths as resolveDatabaseAccess, but for callers that don't
// already know which database a key belongs to — the remote MCP endpoint
// (app/mcp/route.ts and app/mcp/[apiKey]/route.ts), which is one shared
// URL rather than a per-database path. Session cookies aren't accepted
// here: that endpoint is meant for external tool clients (ChatGPT, Claude,
// etc.) presenting a Stashi API key, not a logged-in browser tab. Returns
// which *kind* of key it was so the caller can decide whether to register
// tools fixed to one database or parameterized across all of them.
export async function resolveAccessByApiKey(apiKey: string): Promise<ApiKeyAccess | null> {
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT id, owner_email FROM databases WHERE api_key = $1`, [apiKey]);
  if (rows[0]) return { kind: "database", email: rows[0].owner_email, databaseId: rows[0].id, scope: "full" };

  const scoped = await resolveScopedKey(apiKey);
  if (scoped) {
    return { kind: "database", email: scoped.email, databaseId: scoped.databaseId, scope: scoped.scope, keyLabel: scoped.label };
  }

  const account = await resolveAccountKey(apiKey);
  if (account) return { kind: "account", email: account.email, scope: account.scope, keyLabel: account.label };

  return null;
}
