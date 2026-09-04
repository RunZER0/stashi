import { NextResponse } from "next/server";
import { resolveDatabaseAccess } from "@/lib/auth";
import { getDatabase, recordActivity, createCheckpoint, getCheckpoint } from "@/lib/store";
import { getQueryPool } from "@/lib/query-pool";
import { isReadOnlyStatement, classifyDestructive, closestMatch } from "@/lib/sql-safety";

const STATEMENT_TIMEOUT_MS = 15000;
const MAX_ROWS = 500;
const AUTO_CHECKPOINT_TIMEOUT_MS = 15000;

const DESTRUCTIVE_LABELS: Record<string, string> = {
  ddl: "before schema change",
  truncate: "before TRUNCATE",
  delete_without_where: "before unfiltered DELETE",
  update_without_where: "before unfiltered UPDATE",
};

// Waits for an auto-checkpoint job to actually finish before letting the
// destructive statement it's protecting run — a checkpoint that's still
// "pending" when the DROP TABLE executes wouldn't protect anything. Polls
// rather than blocks on the job queue directly since that's the same
// interface the console and MCP server already observe checkpoint state
// through.
async function waitForCheckpoint(checkpointId: string, timeoutMs: number): Promise<"ready" | "failed" | "timeout"> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cp = await getCheckpoint(checkpointId);
    if (cp?.status === "ready") return "ready";
    if (cp?.status === "failed") return "failed";
    await new Promise((r) => setTimeout(r, 400));
  }
  return "timeout";
}

// Postgres error codes worth translating into something an LLM (the actual
// reader of most of these errors, via the MCP server) can act on without a
// human decoding a raw SQLSTATE.
function humanizeError(err: any, availableTables: string[]): string {
  const code = err.code;
  const raw = err.message || "Query failed";

  if (code === "42P01") {
    // relation "foo" does not exist
    const match = raw.match(/relation "([^"]+)" does not exist/);
    const name = match?.[1];
    const suggestion = name ? closestMatch(name.replace(/^public\./, ""), availableTables) : null;
    return suggestion
      ? `${raw} — did you mean "${suggestion}"? (closest match among tables in this database)`
      : `${raw} — call list_tables (or list_tables via MCP) to see what actually exists here.`;
  }

  if (code === "42703") {
    // column "foo" does not exist
    return `${raw} — call describe_table for the table you're querying to see its real column names.`;
  }

  if (code === "42501") {
    return `${raw} — this key's role doesn't have permission for that. If this is a read-only agent key, only SELECT-style queries are allowed.`;
  }

  if (code === "23505") {
    return `${raw} — a unique constraint rejected this write; the row already exists.`;
  }

  if (code === "57014") {
    return `Query cancelled: exceeded the ${STATEMENT_TIMEOUT_MS / 1000}s statement timeout. Narrow the query (add a LIMIT, filter more, or add an index) rather than retrying as-is.`;
  }

  return raw;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const access = await resolveDatabaseAccess(request, id);
  if (!access) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { email, via, scope, keyLabel } = access;
  const body = (await request.json().catch(() => ({}))) as { sql?: string };
  const sql = (body.sql || "").trim();
  if (!sql) return NextResponse.json({ error: "sql is required" }, { status: 400 });

  const db = await getDatabase(email, id);
  if (!db) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (db.status !== "healthy") {
    return NextResponse.json({ error: `Database is ${db.status}, not ready for queries.` }, { status: 409 });
  }

  if (scope === "readonly" && !isReadOnlyStatement(sql)) {
    return NextResponse.json(
      { error: "This API key is read-only. Only SELECT / WITH / EXPLAIN / SHOW / TABLE statements are allowed." },
      { status: 403 }
    );
  }

  const actor = via === "apiKey" ? (keyLabel ? `agent:${keyLabel}` : "agent") : "you";

  // Auto-checkpoint: an agent that forgets to call create_checkpoint before
  // a risky statement still gets protected. Only for full-scope keys/humans
  // — a read-only key can never reach a destructive statement in the first
  // place (blocked above), so there's nothing to protect there.
  const destructiveReason = scope === "full" ? classifyDestructive(sql) : null;
  let autoCheckpointId: string | null = null;
  if (destructiveReason) {
    try {
      const { checkpoint } = await createCheckpoint(
        email,
        id,
        "auto",
        `Auto-checkpoint ${DESTRUCTIVE_LABELS[destructiveReason]}`,
        actor
      );
      autoCheckpointId = checkpoint.id;
      const outcome = await waitForCheckpoint(checkpoint.id, AUTO_CHECKPOINT_TIMEOUT_MS);
      if (outcome !== "ready") {
        return NextResponse.json(
          {
            error: `This statement looked destructive (${destructiveReason.replace(/_/g, " ")}), so it was blocked until a safety checkpoint could be taken — and that checkpoint ${outcome === "timeout" ? "didn't finish in time" : "failed"}. The statement was not run. Try again, or call create_checkpoint yourself first.`,
            autoCheckpointId,
          },
          { status: 409 }
        );
      }
    } catch (err: any) {
      return NextResponse.json(
        { error: `Couldn't take the required safety checkpoint before this destructive statement: ${err.message}. The statement was not run.` },
        { status: 409 }
      );
    }
  }

  const pool = getQueryPool(db);
  const startedAt = Date.now();
  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    return NextResponse.json({ error: `Couldn't connect to the database: ${err.message}` }, { status: 502 });
  }

  try {
    // statement_timeout is applied as a `SET` query, not a pg.Client
    // startup-packet option: PgBouncer in transaction-pooling mode only
    // allows a fixed allowlist of startup parameters and rejects anything
    // else outright (confirmed live — "unsupported startup parameter:
    // statement_timeout" from PgBouncer itself, not Postgres). It's re-set
    // on every request even though the connection is now pooled, since a
    // pooled connection can be handed back for the next unrelated query.
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
    const result = await client.query(sql);
    const durationMs = Date.now() - startedAt;

    const rows = Array.isArray(result.rows) ? result.rows : [];
    const truncated = rows.length > MAX_ROWS;

    await recordActivity(
      email,
      actor,
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
      autoCheckpointId,
    });
  } catch (err: any) {
    const durationMs = Date.now() - startedAt;
    let availableTables: string[] = [];
    if (err.code === "42P01") {
      try {
        const { rows } = await client.query(
          `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')`
        );
        availableTables = rows.map((r: any) => r.relname);
      } catch {
        // best-effort only — the original error still gets returned either way
      }
    }
    return NextResponse.json(
      { error: humanizeError(err, availableTables), durationMs, autoCheckpointId },
      { status: 400 }
    );
  } finally {
    // Release back to the pool, not end() — that's the entire point of
    // pooling. A bad/broken connection is detected by pg itself and evicted
    // from the pool rather than reused.
    client.release();
  }
}
