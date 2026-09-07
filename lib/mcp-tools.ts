import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { POST as queryRoute } from "@/app/api/databases/[id]/query/route";
import { GET as checkpointsGetRoute, POST as checkpointsPostRoute } from "@/app/api/databases/[id]/checkpoints/route";
import { POST as restoreRoute } from "@/app/api/databases/[id]/checkpoints/[checkpointId]/restore/route";
import { POST as keysPostRoute } from "@/app/api/databases/[id]/keys/route";
import { POST as branchRoute } from "@/app/api/databases/[id]/branch/route";
import { GET as databasesGetRoute } from "@/app/api/databases/route";

// Registers the same tool set as mcp-server/index.js (the local stdio
// package for Claude Desktop/Cursor/Windsurf), adapted for the remote HTTP
// endpoint at app/mcp/route.ts: instead of a fixed DATABASE_ID/API_URL
// read from process.env once at process start, every value here comes from
// the single request that's being served, since a stateless HTTP handler
// has no long-lived process to hold them in. Keep the tool set and
// descriptions in sync with mcp-server/index.js by hand -- they're
// necessarily separate packages (one's published to npm and spawned
// locally, this one runs inside the Next.js server), so there's no shared
// module to import from.
//
// Every tool still runs through the same route handlers
// (/api/databases/:id/...) that the console and the stdio server use --
// that's what keeps auto-checkpointing, destructive-statement blocking,
// read-only enforcement, and the audit log all in the one real code path
// regardless of which door an agent came in through. Called *directly* as
// in-process functions (invokeRoute below), not over HTTP: a self-fetch
// from this server back to its own public URL is exactly the kind of call
// that silently breaks on PaaS platforms like Render, where a service's
// outbound request often can't route back to its own public ingress
// (confirmed here -- the same endpoint answered instantly for an external
// caller and failed with "fetch failed" for this server calling itself).
// Importing the route modules and invoking their exported handlers
// directly sidesteps the network hop entirely while still reusing their
// logic unchanged.
//
// Two ways to register these, depending on what kind of key connected:
//   - registerDatabaseTools: a per-database key (primary or scoped).
//     databaseId is fixed for the whole connection, so it's not an input
//     the model has to pass -- exactly the shape shipped originally.
//   - registerAccountTools: an account-level key, valid across every
//     database the caller owns. Same tool bodies, but databaseId becomes a
//     required input on each one (plus a new list_databases tool to
//     discover valid ids), since a stateless HTTP handler has no session
//     to remember "which database" between calls -- the model just passes
//     it on every call instead, using the id list_databases gave it.

export type BaseMcpContext = {
  origin: string;
  apiKey: string;
};

// A route handler only ever reads request.url for its own querystring (none
// of the routes called here have one) -- the value just has to be a
// syntactically valid absolute URL, never actually dispatched anywhere.
const INTERNAL_URL = "http://internal.invalid/";

async function invokeRoute<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (request: Request, context: any) => Promise<Response>,
  opts: { apiKey: string; method: "GET" | "POST"; params?: Record<string, string>; body?: unknown }
): Promise<T> {
  const request = new Request(INTERNAL_URL, {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const response = await handler(request, { params: Promise.resolve(opts.params ?? {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Stashi internal call returned ${response.status}`);
  }
  return payload as T;
}

const runQuery = (ctx: BaseMcpContext, databaseId: string, sql: string) =>
  invokeRoute(queryRoute, { apiKey: ctx.apiKey, method: "POST", params: { id: databaseId }, body: { sql } });

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const MEMORY_TABLE = "agent_memory";

function vectorLiteral(embedding: number[]) {
  const nums = embedding.map((n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) throw new Error("embedding must be an array of finite numbers");
    return v;
  });
  return `[${nums.join(",")}]`;
}

async function ensureMemoryTable(ctx: BaseMcpContext, databaseId: string, dimension: number) {
  await runQuery(
    ctx,
    databaseId,
    `CREATE TABLE IF NOT EXISTS ${MEMORY_TABLE} (
      id bigserial PRIMARY KEY,
      content text NOT NULL,
      embedding public.vector(${dimension}) NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  );
  await runQuery(
    ctx,
    databaseId,
    `CREATE INDEX IF NOT EXISTS ${MEMORY_TABLE}_embedding_idx ON ${MEMORY_TABLE} USING hnsw (embedding public.vector_cosine_ops)`
  );
}

// --- Tool bodies, parameterized by databaseId ---------------------------

async function actionListDatabases(ctx: BaseMcpContext) {
  try {
    const result = await invokeRoute<{ databases: any[] }>(databasesGetRoute, { apiKey: ctx.apiKey, method: "GET" });
    const databases = (result.databases || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      plan: d.plan,
      status: d.status,
      region: d.region,
    }));
    return textResult(databases);
  } catch (err) {
    return errorResult(err);
  }
}

async function actionListTables(ctx: BaseMcpContext, databaseId: string) {
  try {
    const result = await runQuery(
      ctx,
      databaseId,
      `SELECT c.relname AS table_name,
              c.reltuples::bigint AS estimated_rows,
              pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
       ORDER BY c.relname;`
    );
    return textResult(result.rows);
  } catch (err) {
    return errorResult(err);
  }
}

async function actionDescribeTable(ctx: BaseMcpContext, databaseId: string, table: string) {
  try {
    const result = await runQuery(
      ctx,
      databaseId,
      `SELECT column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = '${table.replace(/'/g, "''")}'
       ORDER BY ordinal_position;`
    );
    if (result.rows.length === 0) return textResult(`No table named "${table}" found (or it has no columns).`);
    return textResult(result.rows);
  } catch (err) {
    return errorResult(err);
  }
}

async function actionRunQuery(ctx: BaseMcpContext, databaseId: string, sql: string) {
  try {
    const result = await runQuery(ctx, databaseId, sql);
    return textResult({
      command: result.command,
      rowCount: result.rowCount,
      rows: result.rows,
      truncated: result.truncated,
    });
  } catch (err) {
    return errorResult(err);
  }
}

async function actionCreateCheckpoint(ctx: BaseMcpContext, databaseId: string, label?: string) {
  try {
    const result = await invokeRoute<{ checkpoint: { id: string; label: string } }>(checkpointsPostRoute, {
      apiKey: ctx.apiKey,
      method: "POST",
      params: { id: databaseId },
      body: { kind: "checkpoint", label: label || "Agent checkpoint" },
    });
    return textResult(`Checkpoint "${result.checkpoint.label}" (${result.checkpoint.id}) is being created.`);
  } catch (err) {
    return errorResult(err);
  }
}

async function actionRollbackLastCheckpoint(ctx: BaseMcpContext, databaseId: string) {
  try {
    const list = await invokeRoute<{ checkpoints: { id: string; label: string; status: string }[] }>(checkpointsGetRoute, {
      apiKey: ctx.apiKey,
      method: "GET",
      params: { id: databaseId },
    });
    const latest = (list.checkpoints || []).find((c) => c.status === "ready");
    if (!latest) return textResult("No ready checkpoint to roll back to yet — call create_checkpoint first.");
    await invokeRoute(restoreRoute, { apiKey: ctx.apiKey, method: "POST", params: { id: databaseId, checkpointId: latest.id } });
    return textResult(`Rolling back to checkpoint "${latest.label}" (${latest.id}). This database will be briefly unavailable.`);
  } catch (err) {
    return errorResult(err);
  }
}

async function actionCreateAgentKey(ctx: BaseMcpContext, databaseId: string, label: string, scope?: "full" | "readonly") {
  try {
    const result = await invokeRoute<{ key: { label: string; scope: string; apiKey: string } }>(keysPostRoute, {
      apiKey: ctx.apiKey,
      method: "POST",
      params: { id: databaseId },
      body: { label, scope: scope || "readonly" },
    });
    return textResult(
      `Created a ${result.key.scope} key labeled "${result.key.label}": ${result.key.apiKey}\nHand this to the subagent along with STASHI_DATABASE_ID=${databaseId} and STASHI_API_URL=${ctx.origin} — it will not be shown again in full.`
    );
  } catch (err) {
    return errorResult(err);
  }
}

async function actionCreateBranch(ctx: BaseMcpContext, databaseId: string, name: string, ttlHours?: number) {
  try {
    const result = await invokeRoute<{ database: { id: string; name: string } }>(branchRoute, {
      apiKey: ctx.apiKey,
      method: "POST",
      params: { id: databaseId },
      body: { name, ttlHours },
    });
    return textResult(
      `Branch "${result.database.name}" (${result.database.id}) is being created from a live dump of this database.${ttlHours ? ` Auto-deletes in ${ttlHours}h.` : ""} Connect with its own credentials once its status is "healthy" (check via the console, or list_tables against the new id once you have its API key).`
    );
  } catch (err) {
    return errorResult(err);
  }
}

async function actionStoreMemory(ctx: BaseMcpContext, databaseId: string, content: string, embedding: number[], metadata?: Record<string, unknown>) {
  const escaped = content.replace(/'/g, "''");
  const meta = JSON.stringify(metadata || {}).replace(/'/g, "''");
  const insertSql = `INSERT INTO ${MEMORY_TABLE} (content, embedding, metadata) VALUES ('${escaped}', '${vectorLiteral(embedding)}', '${meta}'::jsonb) RETURNING id`;
  try {
    const result = await runQuery(ctx, databaseId, insertSql);
    return textResult(`Stored memory #${result.rows[0]?.id}.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/does not exist/i.test(message)) return errorResult(err);
    try {
      await ensureMemoryTable(ctx, databaseId, embedding.length);
      const result = await runQuery(ctx, databaseId, insertSql);
      return textResult(`Stored memory #${result.rows[0]?.id}. (Created the agent_memory table on this first call.)`);
    } catch (err2) {
      return errorResult(err2);
    }
  }
}

async function actionSearchMemory(ctx: BaseMcpContext, databaseId: string, embedding: number[], topK?: number) {
  try {
    const limit = Math.min(Math.max(Number(topK) || 5, 1), 50);
    const result = await runQuery(
      ctx,
      databaseId,
      `SELECT id, content, metadata, created_at, embedding OPERATOR(public.<=>) '${vectorLiteral(embedding)}' AS distance
       FROM ${MEMORY_TABLE} ORDER BY distance ASC LIMIT ${limit}`
    );
    return textResult(result.rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/does not exist/i.test(message)) {
      return textResult("No memories stored yet — call store_memory at least once first.");
    }
    return errorResult(err);
  }
}

// --- Registration: fixed to one database ---------------------------------

export function registerDatabaseTools(server: McpServer, ctx: BaseMcpContext & { databaseId: string }) {
  const { databaseId } = ctx;

  server.registerTool(
    "list_tables",
    { title: "List tables", description: "List every table in this Stashi database's own schema, with row estimate and size.", inputSchema: {} },
    () => actionListTables(ctx, databaseId)
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe table",
      description: "Show columns, types, nullability, and defaults for one table.",
      inputSchema: { table: z.string().describe("Table name, unqualified") },
    },
    ({ table }) => actionDescribeTable(ctx, databaseId, table)
  );

  server.registerTool(
    "run_query",
    {
      title: "Run SQL query",
      description:
        "Execute SQL against this database, using its own scoped role — the same access you'd have via psql, nothing more. 15s timeout, 500 row cap. Shows up in the customer's audit log.",
      inputSchema: { sql: z.string().describe("SQL to execute") },
    },
    ({ sql }) => actionRunQuery(ctx, databaseId, sql)
  );

  server.registerTool(
    "create_checkpoint",
    {
      title: "Create a checkpoint",
      description: "Save a real point-in-time snapshot of this database right now — call this before a risky migration so you can roll back if it goes wrong.",
      inputSchema: { label: z.string().optional().describe("Optional label, e.g. 'before adding orders.status column'") },
    },
    ({ label }) => actionCreateCheckpoint(ctx, databaseId, label)
  );

  server.registerTool(
    "rollback_last_checkpoint",
    {
      title: "Rollback to last checkpoint",
      description: "Undo — wipes all current data and restores the most recent ready checkpoint. Use this when a migration you just ran turned out to be wrong.",
      inputSchema: {},
    },
    () => actionRollbackLastCheckpoint(ctx, databaseId)
  );

  server.registerTool(
    "create_agent_key",
    {
      title: "Create a key for another agent",
      description:
        "Mint a new, separately-revocable API key scoped to this database — for handing off to a subagent instead of sharing this session's own key. Prefer scope 'readonly' unless the subagent genuinely needs to write.",
      inputSchema: {
        label: z.string().describe("Name for the subagent/purpose this key is for, e.g. 'research-subagent'"),
        scope: z.enum(["full", "readonly"]).optional().describe("Defaults to 'readonly' — pass 'full' only if the subagent needs to write"),
      },
    },
    ({ label, scope }) => actionCreateAgentKey(ctx, databaseId, label, scope)
  );

  server.registerTool(
    "create_branch",
    {
      title: "Create a branch",
      description:
        "Spin up a brand-new database seeded with a real copy of this one's current data — for testing a migration or exploring a change without touching production.",
      inputSchema: {
        name: z.string().describe("Name for the branch, e.g. 'test-migration-882'"),
        ttlHours: z.number().optional().describe("Optional: auto-delete the branch after this many hours"),
      },
    },
    ({ name, ttlHours }) => actionCreateBranch(ctx, databaseId, name, ttlHours)
  );

  server.registerTool(
    "store_memory",
    {
      title: "Store a memory",
      description:
        "Store a piece of text plus its embedding vector for later semantic search — agent long-term memory backed by a real pgvector table in this database (auto-created on first use).",
      inputSchema: {
        content: z.string().describe("The text being remembered"),
        embedding: z.array(z.number()).describe("The embedding vector for `content`, as a plain array of numbers"),
        metadata: z.record(z.string(), z.any()).optional().describe("Optional JSON metadata (source, tags, timestamp, etc.)"),
      },
    },
    ({ content, embedding, metadata }) => actionStoreMemory(ctx, databaseId, content, embedding, metadata)
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description: "Find the most semantically similar stored memories to a query embedding (cosine distance over the pgvector index).",
      inputSchema: {
        embedding: z.array(z.number()).describe("Query embedding, same dimension as what was stored"),
        topK: z.number().optional().describe("How many results to return (default 5)"),
      },
    },
    ({ embedding, topK }) => actionSearchMemory(ctx, databaseId, embedding, topK)
  );
}

// --- Registration: account-wide, database chosen per call ----------------

const databaseIdField = z.string().describe("Which database, by id — call list_databases first if you don't already have it");

export function registerAccountTools(server: McpServer, ctx: BaseMcpContext) {
  server.registerTool(
    "list_databases",
    {
      title: "List databases",
      description: "List every database on this account — id, name, plan, status, region. Call this first to get the id to pass to every other tool here.",
      inputSchema: {},
    },
    () => actionListDatabases(ctx)
  );

  server.registerTool(
    "list_tables",
    { title: "List tables", description: "List every table in one database's own schema, with row estimate and size.", inputSchema: { databaseId: databaseIdField } },
    ({ databaseId }) => actionListTables(ctx, databaseId)
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe table",
      description: "Show columns, types, nullability, and defaults for one table.",
      inputSchema: { databaseId: databaseIdField, table: z.string().describe("Table name, unqualified") },
    },
    ({ databaseId, table }) => actionDescribeTable(ctx, databaseId, table)
  );

  server.registerTool(
    "run_query",
    {
      title: "Run SQL query",
      description:
        "Execute SQL against one database, using its own scoped role — the same access you'd have via psql, nothing more. 15s timeout, 500 row cap. Shows up in the customer's audit log.",
      inputSchema: { databaseId: databaseIdField, sql: z.string().describe("SQL to execute") },
    },
    ({ databaseId, sql }) => actionRunQuery(ctx, databaseId, sql)
  );

  server.registerTool(
    "create_checkpoint",
    {
      title: "Create a checkpoint",
      description: "Save a real point-in-time snapshot of one database right now — call this before a risky migration so you can roll back if it goes wrong.",
      inputSchema: { databaseId: databaseIdField, label: z.string().optional().describe("Optional label, e.g. 'before adding orders.status column'") },
    },
    ({ databaseId, label }) => actionCreateCheckpoint(ctx, databaseId, label)
  );

  server.registerTool(
    "rollback_last_checkpoint",
    {
      title: "Rollback to last checkpoint",
      description: "Undo — wipes all current data on one database and restores its most recent ready checkpoint.",
      inputSchema: { databaseId: databaseIdField },
    },
    ({ databaseId }) => actionRollbackLastCheckpoint(ctx, databaseId)
  );

  server.registerTool(
    "create_agent_key",
    {
      title: "Create a key for another agent",
      description:
        "Mint a new, separately-revocable API key scoped to one database — for handing off to a subagent instead of sharing this account key. Prefer scope 'readonly' unless the subagent genuinely needs to write.",
      inputSchema: {
        databaseId: databaseIdField,
        label: z.string().describe("Name for the subagent/purpose this key is for, e.g. 'research-subagent'"),
        scope: z.enum(["full", "readonly"]).optional().describe("Defaults to 'readonly' — pass 'full' only if the subagent needs to write"),
      },
    },
    ({ databaseId, label, scope }) => actionCreateAgentKey(ctx, databaseId, label, scope)
  );

  server.registerTool(
    "create_branch",
    {
      title: "Create a branch",
      description:
        "Spin up a brand-new database seeded with a real copy of one database's current data — for testing a migration or exploring a change without touching production.",
      inputSchema: {
        databaseId: databaseIdField,
        name: z.string().describe("Name for the branch, e.g. 'test-migration-882'"),
        ttlHours: z.number().optional().describe("Optional: auto-delete the branch after this many hours"),
      },
    },
    ({ databaseId, name, ttlHours }) => actionCreateBranch(ctx, databaseId, name, ttlHours)
  );

  server.registerTool(
    "store_memory",
    {
      title: "Store a memory",
      description:
        "Store a piece of text plus its embedding vector for later semantic search on one database — agent long-term memory backed by a real pgvector table (auto-created on first use).",
      inputSchema: {
        databaseId: databaseIdField,
        content: z.string().describe("The text being remembered"),
        embedding: z.array(z.number()).describe("The embedding vector for `content`, as a plain array of numbers"),
        metadata: z.record(z.string(), z.any()).optional().describe("Optional JSON metadata (source, tags, timestamp, etc.)"),
      },
    },
    ({ databaseId, content, embedding, metadata }) => actionStoreMemory(ctx, databaseId, content, embedding, metadata)
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description: "Find the most semantically similar stored memories to a query embedding, on one database.",
      inputSchema: {
        databaseId: databaseIdField,
        embedding: z.array(z.number()).describe("Query embedding, same dimension as what was stored"),
        topK: z.number().optional().describe("How many results to return (default 5)"),
      },
    },
    ({ databaseId, embedding, topK }) => actionSearchMemory(ctx, databaseId, embedding, topK)
  );
}
