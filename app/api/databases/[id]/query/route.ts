import { NextResponse } from "next/server";
import { Client } from "pg";
import { resolveDatabaseAccess } from "@/lib/auth";
import { getDatabase, recordActivity } from "@/lib/store";
import { makeConnectionString } from "@/lib/control-plane";

const STATEMENT_TIMEOUT_MS = 15000;
const MAX_ROWS = 500;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { email, via } = access;
  const body = (await request.json().catch(() => ({}))) as { sql?: string };
  const sql = (body.sql || "").trim();
  if (!sql) return NextResponse.json({ error: "sql is required" }, { status: 400 });

  const db = await getDatabase(email, id);
  if (!db) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (db.status !== "healthy") {
    return NextResponse.json({ error: `Database is ${db.status}, not ready for queries.` }, { status: 409 });
  }

  // Connects through PgBouncer using the tenant's own scoped, non-superuser
  // role — exactly the same access they already have via psql or their app.
  // No extra SQL restrictions needed beyond a timeout and a row cap, which
  // protect the API/browser, not a security boundary.
  //
  // statement_timeout is applied as a `SET` query after connecting, not as a
  // pg.Client startup-packet option: PgBouncer in transaction-pooling mode
  // only allows a fixed allowlist of startup parameters and rejects
  // anything else outright (confirmed live — "unsupported startup
  // parameter: statement_timeout" from PgBouncer itself, not Postgres).
  const client = new Client({
    connectionString: makeConnectionString(db),
    connectionTimeoutMillis: 8000,
  });

  const startedAt = Date.now();
  try {
    await client.connect();
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(sql);
    const durationMs = Date.now() - startedAt;

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const truncated = rows.length > MAX_ROWS;

    await recordActivity(
      email,
      via === "apiKey" ? "agent" : "you",
      "sql.query.executed",
      sql.length > 140 ? `${sql.slice(0, 140)}…` : sql
    );

    return NextResponse.json({
      command: result.command,
      rowCount: result.rowCount,
      fields: (result.fields || []).map((f) => f.name),
      rows: truncated ? rows.slice(0, MAX_ROWS) : rows,
      truncated,
      durationMs,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    return NextResponse.json({ error: err.message || "Query failed", durationMs }, { status: 400 });
  } finally {
    await client.end().catch(() => {});
  }
}
