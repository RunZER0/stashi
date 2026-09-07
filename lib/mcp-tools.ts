import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Registers the same tool set as mcp-server/index.js (the local stdio
// package for Claude Desktop/Cursor/Windsurf), adapted for the remote HTTP
// endpoint at app/api/mcp/route.ts: instead of a fixed DATABASE_ID/API_URL
// read from process.env once at process start, every value here comes from
// the single request that's being served, since a stateless HTTP handler
// has no long-lived process to hold them in. Keep the tool set and
// descriptions in sync with mcp-server/index.js by hand -- they're
// necessarily separate packages (one's published to npm and spawned
// locally, this one runs inside the Next.js server), so there's no shared
// module to import from.
//
// Every tool still calls the same internal REST endpoints
// (/api/databases/:id/...) that the console and the stdio server use,
// rather than touching Postgres or the store directly here -- that's what
// keeps auto-checkpointing, destructive-statement blocking, read-only
// enforcement, and the audit log all in the one real code path regardless
// of which door an agent came in through.

export type McpToolContext = {
  origin: string;
  apiKey: string;
  databaseId: string;
};

async function callApi(ctx: McpToolContext, path: string, options: RequestInit = {}) {
  const res = await fetch(`${ctx.origin}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ctx.apiKey}`,
      ...(options.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Stashi API returned ${res.status}`);
  }
  return payload;
}

const runQuery = (ctx: McpToolContext, sql: string) =>
  callApi(ctx, `/api/databases/${ctx.databaseId}/query`, { method: "POST", body: JSON.stringify({ sql }) });

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

async function ensureMemoryTable(ctx: McpToolContext, dimension: number) {
  await runQuery(
    ctx,
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
    `CREATE INDEX IF NOT EXISTS ${MEMORY_TABLE}_embedding_idx ON ${MEMORY_TABLE} USING hnsw (embedding public.vector_cosine_ops)`
  );
}

export function registerStashiTools(server: McpServer, ctx: McpToolContext) {
  server.registerTool(
    "list_tables",
    {
      title: "List tables",
      description: "List every table in this Stashi database's own schema, with row estimate and size.",
      inputSchema: {},
    },
    async () => {
      try {
        const result = await runQuery(
          ctx,
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
  );

  server.registerTool(
    "describe_table",
    {
      title: "Describe table",
      description: "Show columns, types, nullability, and defaults for one table.",
      inputSchema: { table: z.string().describe("Table name, unqualified") },
    },
    async ({ table }) => {
      try {
        const result = await runQuery(
          ctx,
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
  );

  server.registerTool(
    "run_query",
    {
      title: "Run SQL query",
      description:
        "Execute SQL against this database, using its own scoped role — the same access you'd have via psql, nothing more. 15s timeout, 500 row cap. Shows up in the customer's audit log.",
      inputSchema: { sql: z.string().describe("SQL to execute") },
    },
    async ({ sql }) => {
      try {
        const result = await runQuery(ctx, sql);
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
  );

  server.registerTool(
    "create_checkpoint",
    {
      title: "Create a checkpoint",
      description:
        "Save a real point-in-time snapshot of this database right now — call this before a risky migration so you can roll back if it goes wrong.",
      inputSchema: { label: z.string().optional().describe("Optional label, e.g. 'before adding orders.status column'") },
    },
    async ({ label }) => {
      try {
        const result = await callApi(ctx, `/api/databases/${ctx.databaseId}/checkpoints`, {
          method: "POST",
          body: JSON.stringify({ kind: "checkpoint", label: label || "Agent checkpoint" }),
        });
        return textResult(`Checkpoint "${result.checkpoint.label}" (${result.checkpoint.id}) is being created.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "rollback_last_checkpoint",
    {
      title: "Rollback to last checkpoint",
      description:
        "Undo — wipes all current data and restores the most recent ready checkpoint. Use this when a migration you just ran turned out to be wrong.",
      inputSchema: {},
    },
    async () => {
      try {
        const list = await callApi(ctx, `/api/databases/${ctx.databaseId}/checkpoints`);
        const latest = (list.checkpoints || []).find((c: { status: string }) => c.status === "ready");
        if (!latest) return textResult("No ready checkpoint to roll back to yet — call create_checkpoint first.");
        await callApi(ctx, `/api/databases/${ctx.databaseId}/checkpoints/${latest.id}/restore`, { method: "POST" });
        return textResult(`Rolling back to checkpoint "${latest.label}" (${latest.id}). This database will be briefly unavailable.`);
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "create_agent_key",
    {
      title: "Create a key for another agent",
      description:
        "Mint a new, separately-revocable API key scoped to this database — for handing off to a subagent instead of sharing this session's own key. Prefer scope 'readonly' unless the subagent genuinely needs to write; its actions will show up under its own label in the audit log, distinct from this session's.",
      inputSchema: {
        label: z.string().describe("Name for the subagent/purpose this key is for, e.g. 'research-subagent'"),
        scope: z.enum(["full", "readonly"]).optional().describe("Defaults to 'readonly' — pass 'full' only if the subagent needs to write"),
      },
    },
    async ({ label, scope }) => {
      try {
        const result = await callApi(ctx, `/api/databases/${ctx.databaseId}/keys`, {
          method: "POST",
          body: JSON.stringify({ label, scope: scope || "readonly" }),
        });
        return textResult(
          `Created a ${result.key.scope} key labeled "${result.key.label}": ${result.key.apiKey}\nHand this to the subagent along with STASHI_DATABASE_ID=${ctx.databaseId} and STASHI_API_URL=${ctx.origin} — it will not be shown again in full.`
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "create_branch",
    {
      title: "Create a branch",
      description:
        "Spin up a brand-new database seeded with a real copy of this one's current data — for testing a migration or exploring a change without touching production. Returns a new database id and connection details; that branch has its own MCP setup, it does not share this session's scope.",
      inputSchema: {
        name: z.string().describe("Name for the branch, e.g. 'test-migration-882'"),
        ttlHours: z.number().optional().describe("Optional: auto-delete the branch after this many hours"),
      },
    },
    async ({ name, ttlHours }) => {
      try {
        const result = await callApi(ctx, `/api/databases/${ctx.databaseId}/branch`, {
          method: "POST",
          body: JSON.stringify({ name, ttlHours }),
        });
        return textResult(
          `Branch "${result.database.name}" (${result.database.id}) is being created from a live dump of this database.${ttlHours ? ` Auto-deletes in ${ttlHours}h.` : ""} Connect with its own credentials once its status is "healthy" (check via the console, or list_tables against the new id once you have its API key).`
        );
      } catch (err) {
        return errorResult(err);
      }
    }
  );

  server.registerTool(
    "store_memory",
    {
      title: "Store a memory",
      description:
        "Store a piece of text plus its embedding vector for later semantic search — agent long-term memory backed by a real pgvector table in this database (auto-created on first use). You compute the embedding yourself with whatever model you already call; Stashi just stores and indexes it.",
      inputSchema: {
        content: z.string().describe("The text being remembered"),
        embedding: z.array(z.number()).describe("The embedding vector for `content`, as a plain array of numbers"),
        metadata: z.record(z.string(), z.any()).optional().describe("Optional JSON metadata (source, tags, timestamp, etc.)"),
      },
    },
    async ({ content, embedding, metadata }) => {
      const escaped = content.replace(/'/g, "''");
      const meta = JSON.stringify(metadata || {}).replace(/'/g, "''");
      const insertSql = `INSERT INTO ${MEMORY_TABLE} (content, embedding, metadata) VALUES ('${escaped}', '${vectorLiteral(embedding)}', '${meta}'::jsonb) RETURNING id`;
      try {
        const result = await runQuery(ctx, insertSql);
        return textResult(`Stored memory #${result.rows[0]?.id}.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!/does not exist/i.test(message)) return errorResult(err);
        try {
          await ensureMemoryTable(ctx, embedding.length);
          const result = await runQuery(ctx, insertSql);
          return textResult(`Stored memory #${result.rows[0]?.id}. (Created the agent_memory table on this first call.)`);
        } catch (err2) {
          return errorResult(err2);
        }
      }
    }
  );

  server.registerTool(
    "search_memory",
    {
      title: "Search memory",
      description:
        "Find the most semantically similar stored memories to a query embedding (cosine distance over the pgvector index). Compute the query embedding with the same model used when storing memories, or results will be meaningless.",
      inputSchema: {
        embedding: z.array(z.number()).describe("Query embedding, same dimension as what was stored"),
        topK: z.number().optional().describe("How many results to return (default 5)"),
      },
    },
    async ({ embedding, topK }) => {
      try {
        const limit = Math.min(Math.max(Number(topK) || 5, 1), 50);
        const result = await runQuery(
          ctx,
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
  );
}
