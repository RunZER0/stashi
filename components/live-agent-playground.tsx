"use client";

import { useState } from "react";
import { Terminal, Check, Play, RotateCcw } from "lucide-react";

interface PromptDemo {
  id: string;
  label: string;
  agentPrompt: string;
  toolCall: string;
  sqlExecuted: string;
  rowsAffected: number;
}

const demos: PromptDemo[] = [
  {
    id: "schema",
    label: "Inspect Schema via MCP",
    agentPrompt: "Agent: 'Inspect existing tables and row counts before writing the migration.'",
    toolCall: "list_tables()",
    sqlExecuted: `SELECT c.relname AS table_name, c.reltuples::bigint AS estimated_rows,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
ORDER BY c.relname;`,
    rowsAffected: 18,
  },
  {
    id: "query",
    label: "Run a Scoped Query",
    agentPrompt: "Agent: 'Check for orders stuck in pending status before running the cleanup job.'",
    toolCall: "run_query({ sql: \"select id from orders where status='pending' and created_at < now() - interval '1 day'\" })",
    sqlExecuted: `-- Executed with the tenant's own scoped role, 15s timeout, 500 row cap
-- Same access as psql. Shows up in the audit log as this agent's API key.`,
    rowsAffected: 1,
  },
  {
    id: "checkpoint",
    label: "Undo a Bad Migration",
    agentPrompt: "Agent: 'Migration failed due to a type mismatch in the payments table. Rolling back.'",
    toolCall: "rollback_last_checkpoint()",
    sqlExecuted: `-- Restores the most recent "ready" checkpoint via pg_restore.
-- Database is briefly unavailable while the restore runs.
-- Measured on a live test run: ~5s for a small schema.`,
    rowsAffected: 0,
  },
];

export function LiveAgentPlayground() {
  const [activeDemo, setActiveDemo] = useState<PromptDemo>(demos[0]);
  const [running, setRunning] = useState(false);
  const [executed, setExecuted] = useState(true);

  const triggerRun = (demo: PromptDemo) => {
    setActiveDemo(demo);
    setRunning(true);
    setExecuted(false);
    setTimeout(() => {
      setRunning(false);
      setExecuted(true);
    }, 400);
  };

  return (
    <div
      style={{
        border: "1px solid #1e1e24",
        background: "rgba(10, 10, 12, 0.68)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
        marginTop: "48px",
      }}
    >
      {/* Playground Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          borderBottom: "1px solid #1e1e24",
          background: "#0e0e11",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1478fc", display: "inline-block", boxShadow: "0 0 0 3px rgba(20, 120, 252, 0.18)" }} />
          <span style={{ font: '700 10px/1 "SFMono-Regular", Consolas, monospace', color: "#f0eff2", letterSpacing: ".08em" }}>
            MCP TOOL CALL WALKTHROUGH
          </span>
        </div>
        <span style={{ font: '700 9px/1 "SFMono-Regular", monospace', color: "#797883" }}>
          CLICK AN ACTION — REAL TOOL NAMES, ILLUSTRATIVE DATA
        </span>
      </div>

      {/* Preset Action Buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          borderBottom: "1px solid #1e1e24",
          background: "#080809",
        }}
      >
        {demos.map((d) => {
          const isActive = activeDemo.id === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => triggerRun(d)}
              style={{
                padding: "14px 18px",
                border: 0,
                borderRight: "1px solid #1e1e24",
                borderBottom: isActive ? "2px solid #1478fc" : "2px solid transparent",
                background: isActive ? "#111115" : "transparent",
                color: isActive ? "#1478fc" : "#8f8e98",
                fontFamily: '"SFMono-Regular", Consolas, monospace',
                fontSize: "11px",
                fontWeight: 700,
                textAlign: "left",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all .15s ease",
              }}
            >
              <Play size={12} color={isActive ? "#1478fc" : "#797883"} />
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Simulator Body */}
      <div style={{ padding: "24px", display: "grid", gap: "20px" }}>
        {/* Agent Intent */}
        <div style={{ background: "#111115", border: "1px solid #23232a", padding: "14px 16px" }}>
          <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#1478fc", letterSpacing: ".1em", display: "block", marginBottom: "6px" }}>
            AUTONOMOUS PROMPT INTENT
          </span>
          <p style={{ margin: 0, fontSize: "13px", color: "#f0eff2", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            {activeDemo.agentPrompt}
          </p>
        </div>

        {/* MCP Tool Call + SQL Execution Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#060607", border: "1px solid #1e1e24", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#797883", letterSpacing: ".08em" }}>
                NATIVE MCP TOOL INVOCATION
              </span>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#1478fc" }}>
                {running ? "EXECUTING..." : "DISPATCHED"}
              </span>
            </div>
            <code style={{ fontSize: "11px", color: "#a4a8c9", display: "block", fontFamily: '"SFMono-Regular", Consolas, monospace', lineHeight: 1.5 }}>
              {activeDemo.toolCall}
            </code>
          </div>

          <div style={{ background: "#060607", border: "1px solid #1e1e24", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#797883", letterSpacing: ".08em" }}>
                POSTGRESQL 17 ENGINE EXECUTION
              </span>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#1478fc" }}>
                {running ? "RUNNING..." : "COMPLETE"}
              </span>
            </div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#d8d9e2", fontFamily: '"SFMono-Regular", Consolas, monospace', lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {activeDemo.sqlExecuted}
            </pre>
          </div>
        </div>

        {/* Telemetry Result Bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderTop: "1px solid #1e1e24",
            fontSize: "11px",
            color: "#797883",
            fontFamily: '"SFMono-Regular", Consolas, monospace',
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            <span>Status: <strong style={{ color: "#1478fc" }}>200 OK</strong></span>
            <span>Pooling: <strong style={{ color: "#f0eff2" }}>PgBouncer TLS</strong></span>
            <span>Billing Cost: <strong style={{ color: "#1478fc" }}>$0.00 (Flat plan included)</strong></span>
          </div>
          <span style={{ color: "#8f8e98" }}>
            Hard-capped protection: Active
          </span>
        </div>
      </div>
    </div>
  );
}
