"use client";

import { useState } from "react";
import { Terminal, Check, Play, RotateCcw } from "lucide-react";

interface PromptDemo {
  id: string;
  label: string;
  agentPrompt: string;
  toolCall: string;
  sqlExecuted: string;
  latency: string;
  rowsAffected: number;
}

const demos: PromptDemo[] = [
  {
    id: "schema",
    label: "Inspect Schema via MCP",
    agentPrompt: "Agent: 'Inspect existing tables, column types, and foreign key relations before writing the migration.'",
    toolCall: "stashi_inspect_schema({ include_indexes: true })",
    sqlExecuted: `SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;`,
    latency: "14ms",
    rowsAffected: 18,
  },
  {
    id: "sandbox",
    label: "Spawn Ephemeral Sandbox",
    agentPrompt: "Agent: 'Provision an isolated scratch database for running integration tests against eval suite #94.'",
    toolCall: "stashi_provision_sandbox({ name: 'eval-94', plan: 'dev', auto_ttl: '2h' })",
    sqlExecuted: `CREATE DATABASE eval_sandbox_94_test WITH TEMPLATE template_clean;
GRANT ALL PRIVILEGES ON DATABASE eval_sandbox_94_test TO eval_worker;`,
    latency: "385ms",
    rowsAffected: 1,
  },
  {
    id: "checkpoint",
    label: "Undo Hallucinated Migration",
    agentPrompt: "Agent: 'Migration failed due to type mismatch in payments table. Triggering instant rollback.'",
    toolCall: "stashi_rollback_checkpoint({ checkpoint_id: 'cp_pre_migration_882' })",
    sqlExecuted: `-- RESTORING SNAPSHOT #cp_pre_migration_882
ALTER TABLE accounts DROP COLUMN IF EXISTS temp_balance_calc;
-- State verified healthy. Zero data loss.`,
    latency: "42ms",
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
        border: "1px solid #1e241e",
        background: "rgba(10, 12, 10, 0.68)",
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
          borderBottom: "1px solid #1e241e",
          background: "#0e110e",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#34d399", display: "inline-block", boxShadow: "0 0 8px rgba(52, 211, 153, 0.6)" }} />
          <span style={{ font: '700 10px/1 "SFMono-Regular", Consolas, monospace', color: "#f0f2ef", letterSpacing: ".08em" }}>
            LIVE AGENTIC INTERACTIVE SIMULATOR
          </span>
        </div>
        <span style={{ font: '700 9px/1 "SFMono-Regular", monospace', color: "#798378" }}>
          CLICK AN ACTION TO TEST MCP EXECUTION
        </span>
      </div>

      {/* Preset Action Buttons */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          borderBottom: "1px solid #1e241e",
          background: "#080908",
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
                borderRight: "1px solid #1e241e",
                borderBottom: isActive ? "2px solid #34d399" : "2px solid transparent",
                background: isActive ? "#111511" : "transparent",
                color: isActive ? "#34d399" : "#8f988e",
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
              <Play size={12} color={isActive ? "#34d399" : "#798378"} />
              {d.label}
            </button>
          );
        })}
      </div>

      {/* Simulator Body */}
      <div style={{ padding: "24px", display: "grid", gap: "20px" }}>
        {/* Agent Intent */}
        <div style={{ background: "#111511", border: "1px solid #232a23", padding: "14px 16px" }}>
          <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#34d399", letterSpacing: ".1em", display: "block", marginBottom: "6px" }}>
            AUTONOMOUS PROMPT INTENT
          </span>
          <p style={{ margin: 0, fontSize: "13px", color: "#f0f2ef", fontFamily: "Inter, sans-serif", lineHeight: 1.5 }}>
            {activeDemo.agentPrompt}
          </p>
        </div>

        {/* MCP Tool Call + SQL Execution Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={{ background: "#060706", border: "1px solid #1e241e", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#798378", letterSpacing: ".08em" }}>
                NATIVE MCP TOOL INVOCATION
              </span>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#34d399" }}>
                {running ? "EXECUTING..." : "DISPATCHED"}
              </span>
            </div>
            <code style={{ fontSize: "11px", color: "#a4c9a8", display: "block", fontFamily: '"SFMono-Regular", Consolas, monospace', lineHeight: 1.5 }}>
              {activeDemo.toolCall}
            </code>
          </div>

          <div style={{ background: "#060706", border: "1px solid #1e241e", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#798378", letterSpacing: ".08em" }}>
                POSTGRESQL 17 ENGINE EXECUTION
              </span>
              <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#34d399" }}>
                {running ? "RUNNING..." : `${activeDemo.latency} latency`}
              </span>
            </div>
            <pre style={{ margin: 0, fontSize: "11px", color: "#d8e2d9", fontFamily: '"SFMono-Regular", Consolas, monospace', lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
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
            borderTop: "1px solid #1e241e",
            fontSize: "11px",
            color: "#798378",
            fontFamily: '"SFMono-Regular", Consolas, monospace',
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "16px" }}>
            <span>Status: <strong style={{ color: "#34d399" }}>200 OK</strong></span>
            <span>Pooling: <strong style={{ color: "#f0f2ef" }}>PgBouncer TLS</strong></span>
            <span>Billing Cost: <strong style={{ color: "#34d399" }}>$0.00 (Flat plan included)</strong></span>
          </div>
          <span style={{ color: "#8f988e" }}>
            Hard-capped protection: Active
          </span>
        </div>
      </div>
    </div>
  );
}
