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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[stashi-mcp] Connected. Scoped to database", DATABASE_ID, "via", API_URL);
