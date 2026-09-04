"use client";

import { useState } from "react";
import { Check, Clipboard, Database, Terminal } from "lucide-react";
import styles from "./marketing.module.css";

export function HeroVisual() {
  const [mode, setMode] = useState<"agent" | "db">("agent");
  const [copied, setCopied] = useState(false);

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const agentSnippet = `{
  "tool": "create_checkpoint",
  "params": {
    "label": "before orders.status migration"
  }
}`;

  return (
    <div className={styles.heroVisual} aria-label="Stashi dashboard and agent workflow preview">
      <div className={styles.heroFrame} />

      <div className={styles.heroChips}>
        <span className={styles.heroChip}>
          <Terminal size={11} />
          Live terminal session
        </span>
        <span className={styles.heroChip}>
          <Database size={11} />
          PostgreSQL 17 · agent-ready
        </span>
      </div>

      <div className={styles.dashboard}>
        {/* Toggle Mode Bar */}
        <div style={{ display: "flex", borderBottom: "1px solid #1c221c", background: "#080a08" }}>
          <button
            type="button"
            onClick={() => setMode("agent")}
            style={{
              flex: 1,
              padding: "11px 14px",
              border: 0,
              borderBottom: mode === "agent" ? "2px solid #34d399" : "2px solid transparent",
              background: mode === "agent" ? "#111411" : "transparent",
              fontWeight: 700,
              fontSize: "10px",
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              color: mode === "agent" ? "#f5f6f4" : "#798378",
              cursor: "pointer",
              letterSpacing: ".06em",
              transition: "all .15s ease",
            }}
          >
            AGENT &amp; MCP MODE
          </button>
          <button
            type="button"
            onClick={() => setMode("db")}
            style={{
              flex: 1,
              padding: "11px 14px",
              border: 0,
              borderBottom: mode === "db" ? "2px solid #34d399" : "2px solid transparent",
              background: mode === "db" ? "#111411" : "transparent",
              fontWeight: 700,
              fontSize: "10px",
              fontFamily: '"SFMono-Regular", Consolas, monospace',
              color: mode === "db" ? "#f5f6f4" : "#798378",
              cursor: "pointer",
              letterSpacing: ".06em",
              transition: "all .15s ease",
            }}
          >
            DATABASE VIEW
          </button>
        </div>

        {mode === "agent" ? (
          <div>
            <div className={styles.dashboardTop}>
              <span>MCP TOOL CALL · AUTONOMOUS AGENT</span>
              <b>CHECKPOINT SAVED (~2s)</b>
            </div>

            <div style={{ padding: "16px 18px", background: "#060706", color: "#e8ece7", borderBottom: "1px solid #1c221c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#798378", letterSpacing: ".06em" }}>
                  TOOL INVOCATION (JSON)
                </span>
                <button
                  type="button"
                  onClick={() => copySnippet(agentSnippet)}
                  style={{
                    border: "1px solid #2d382d",
                    background: "#161c16",
                    color: "#a4b5a6",
                    fontSize: "9px",
                    padding: "3px 7px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    fontFamily: '"SFMono-Regular", monospace',
                    transition: "border-color .15s ease",
                  }}
                >
                  {copied ? <Check size={10} color="#34d399" /> : <Clipboard size={10} />}
                  {copied ? "COPIED" : "COPY TOOL"}
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: "9px",
                  fontFamily: '"SFMono-Regular", Consolas, monospace',
                  color: "#a2cbb1",
                  lineHeight: 1.45,
                  overflowX: "auto",
                }}
              >
                {agentSnippet}
              </pre>
            </div>

            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span>GUARDRAILS</span>
                <strong>$1 Cap</strong>
                <small>No loop overages</small>
              </div>
              <div className={styles.metric}>
                <span>CHECKPOINT TIME</span>
                <strong>~2s</strong>
                <small>Measured, not estimated</small>
              </div>
              <div className={styles.metric}>
                <span>TOOL</span>
                <strong>create_checkpoint</strong>
                <small>via MCP</small>
              </div>
            </div>

            <div className={styles.connection}>
              <div className={styles.connectionLabel}>
                <span>AGENT DATABASE URL</span>
                <span style={{ color: "#34d399" }}>TLS + PGBOUNCER</span>
              </div>
              <code>postgresql://agent_scoped_role:••••••••@db.stashi.dev:6432/orders_api?sslmode=require</code>
            </div>
          </div>
        ) : (
          <div>
            <div className={styles.dashboardTop}>
              <span>STASHI / DATABASE</span>
              <b style={{ color: "#34d399" }}>HEALTHY</b>
            </div>
            <div className={styles.dashboardHead}>
              <div>
                <span>DATABASE</span>
                <strong>payments-api</strong>
              </div>
              <div className={styles.status}>ONLINE</div>
            </div>
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <span>STORAGE</span>
                <strong>842 MB</strong>
                <small>5 GB limit</small>
              </div>
              <div className={styles.metric}>
                <span>CONNECTIONS</span>
                <strong>7</strong>
                <small>30 limit</small>
              </div>
              <div className={styles.metric}>
                <span>PLAN</span>
                <strong>Starter</strong>
                <small>$3/mo flat</small>
              </div>
            </div>
            <div className={styles.connection}>
              <div className={styles.connectionLabel}>
                <span>CONNECTION STRING</span>
                <span style={{ color: "#34d399" }}>TLS REQUIRED</span>
              </div>
              <code>postgresql://payments_owner:••••••@db.stashi.dev:6432/payments?sslmode=require</code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
