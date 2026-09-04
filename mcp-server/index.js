#!/usr/bin/env node
/**
 * Stashi MCP Server
 *
 * Gives an AI agent (Claude Desktop, Cursor, etc.) real, scoped access to a
 * single Stashi PostgreSQL database: schema inspection, query execution, and
 * checkpoint/rollback — no human in the loop for any of it.
 *
 * Every tool call routes through the Stashi control-plane API (authenticated
 * with STASHI_API_KEY, scoped to exactly one database), not a direct
 * Postgres connection. Two reasons: it's how checkpoint/rollback actually
 * get dispatched to the node agent, and it means every query an agent runs
 * shows up in the same audit trail a human's queries do — "here's exactly
 * what your agent did" only works if the agent's actions go through the one
 * real path, not a side door.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_KEY = process.env.STASHI_API_KEY;
const DATABASE_ID = process.env.STASHI_DATABASE_ID;
const API_URL = (process.env.STASHI_API_URL || "https://stashi.onrender.com").replace(/\/$/, "");

if (!API_KEY || !DATABASE_ID) {
  console.error("[stashi-mcp] STASHI_API_KEY and STASHI_DATABASE_ID must both be set — copy the config from your Stashi console's Agent & MCP tab.");
  process.exit(1);
}

async function callApi(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
      ...(options.headers || {}),
    },
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Stashi API returned ${res.status}`);
  }
  return payload;
}

async function runQuery(sql) {
  return callApi(`/api/databases/${DATABASE_ID}/query`, {
    method: "POST",
    body: JSON.stringify({ sql }),
  });
}

function textResult(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: "text", text: `Error: ${err.message || String(err)}` }], isError: true };
}

const server = new McpServer(
  { name: "stashi", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.registerTool(
  "list_tables",
  {
    title: "List tables",
    description: "List every table in this Stashi database's own schema, with row estimate and size.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await runQuery(`
        SELECT c.relname AS table_name,
               c.reltuples::bigint AS estimated_rows,
               pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY c.relname;
      `);
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
      const result = await runQuery(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = '${table.replace(/'/g, "''")}'
        ORDER BY ordinal_position;
      `);
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
      const result = await runQuery(sql);
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
      const result = await callApi(`/api/databases/${DATABASE_ID}/checkpoints`, {
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
      const list = await callApi(`/api/databases/${DATABASE_ID}/checkpoints`);
      const latest = (list.checkpoints || []).find((c) => c.status === "ready");
      if (!latest) return textResult("No ready checkpoint to roll back to yet — call create_checkpoint first.");
      await callApi(`/api/databases/${DATABASE_ID}/checkpoints/${latest.id}/restore`, { method: "POST" });
      return textResult(`Rolling back to checkpoint "${latest.label}" (${latest.id}). This database will be briefly unavailable.`);
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
      const result = await callApi(`/api/databases/${DATABASE_ID}/branch`, {
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

// Agent memory: a plain table with a pgvector column, created lazily on
// first use. Stashi provides the storage and nearest-neighbor search --
// the embedding itself is the agent's own responsibility (whatever model
// it already calls), passed in as a plain array of numbers. The table's
// vector dimension is fixed by whatever the first stored embedding's
// length is; every call after that must match it.
const MEMORY_TABLE = "agent_memory";

function vectorLiteral(embedding) {
  const nums = embedding.map((n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) throw new Error("embedding must be an array of finite numbers");
    return v;
  });
  return `[${nums.join(",")}]`;
}

async function ensureMemoryTable(dimension) {
  // pgvector installs into the database's `public` schema (no SCHEMA
  // clause on CREATE EXTENSION). That's invisible under a pooled tenant's
  // search_path, which is deliberately scoped to just their own schema for
  // isolation — so the vector type and its operator classes have to be
  // referenced schema-qualified here regardless of tenancy mode.
  await runQuery(
    `CREATE TABLE IF NOT EXISTS ${MEMORY_TABLE} (
      id bigserial PRIMARY KEY,
      content text NOT NULL,
      embedding public.vector(${dimension}) NOT NULL,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    )`
  );
  await runQuery(
    `CREATE INDEX IF NOT EXISTS ${MEMORY_TABLE}_embedding_idx ON ${MEMORY_TABLE} USING hnsw (embedding public.vector_cosine_ops)`
  );
}

server.registerTool(
  "store_memory",
  {
    title: "Store a memory",
    description:
      "Store a piece of text plus its embedding vector for later semantic search — agent long-term memory backed by a real pgvector table in this database (auto-created on first use). You compute the embedding yourself with whatever model you already call; Stashi just stores and indexes it.",
    inputSchema: {
      content: z.string().describe("The text being remembered"),
      embedding: z.array(z.number()).describe("The embedding vector for `content`, as a plain array of numbers"),
      metadata: z.record(z.any()).optional().describe("Optional JSON metadata (source, tags, timestamp, etc.)"),
    },
  },
  async ({ content, embedding, metadata }) => {
    const escaped = content.replace(/'/g, "''");
    const meta = JSON.stringify(metadata || {}).replace(/'/g, "''");
    const insertSql = `INSERT INTO ${MEMORY_TABLE} (content, embedding, metadata) VALUES ('${escaped}', '${vectorLiteral(embedding)}', '${meta}'::jsonb) RETURNING id`;
    try {
      // Try the plain insert first — after the first call ever, this is the
      // only thing that runs, no DDL, no auto-checkpoint overhead. Only
      // fall back to creating the table (and eating that one-time DDL cost)
      // when it genuinely doesn't exist yet.
      const result = await runQuery(insertSql);
      return textResult(`Stored memory #${result.rows[0]?.id}.`);
    } catch (err) {
      if (!/does not exist/i.test(err.message || "")) return errorResult(err);
      try {
        await ensureMemoryTable(embedding.length);
        const result = await runQuery(insertSql);
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
      // OPERATOR(public.<=>), not bare <=>: same search_path issue as the
      // vector type itself — a pooled tenant's search_path doesn't include
      // public, where pgvector's operators live.
      const result = await runQuery(
        `SELECT id, content, metadata, created_at, embedding OPERATOR(public.<=>) '${vectorLiteral(embedding)}' AS distance
         FROM ${MEMORY_TABLE} ORDER BY distance ASC LIMIT ${limit}`
      );
      return textResult(result.rows);
    } catch (err) {
      if (/does not exist/i.test(err.message || "")) {
        return textResult("No memories stored yet — call store_memory at least once first.");
      }
      return errorResult(err);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[stashi-mcp] Connected. Scoped to database", DATABASE_ID, "via", API_URL);
