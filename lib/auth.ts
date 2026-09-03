import { cookies } from "next/headers";
import { ensureSchema, getPool } from "./db";

// Two ways to prove you may act on a given database: a browser session
// cookie (the console), or a Bearer STASHI_API_KEY scoped to that exact
// database (the MCP server, running on the customer's own machine — it has
// no session, only the API key shown in the console's MCP config).
export async function resolveDatabaseAccess(
  request: Request,
  databaseId: string
): Promise<{ email: string; via: "session" | "apiKey" } | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = authHeader.slice(7).trim();
    if (!apiKey) return null;
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT owner_email FROM databases WHERE id = $1 AND api_key = $2`, [
      databaseId,
      apiKey,
    ]);
    return rows[0] ? { email: rows[0].owner_email, via: "apiKey" } : null;
  }

  const email = (await cookies()).get("stashi_session")?.value;
  return email ? { email, via: "session" } : null;
}
