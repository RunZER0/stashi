"use client";

import { useState, type KeyboardEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { Play } from "lucide-react";

type QueryResult = {
  command: string;
  rowCount: number | null;
  fields: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
  durationMs: number;
};

const DEFAULT_QUERY =
  "SELECT table_name, table_type\nFROM information_schema.tables\nWHERE table_schema NOT IN ('pg_catalog', 'information_schema')\nORDER BY table_name\nLIMIT 20;";

export function SqlEditor({ databaseId }: { databaseId: string }) {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const run = async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/databases/${databaseId}/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sql: query }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error || "Query failed");
        setResult(null);
      } else {
        setResult(payload);
        setHistory((h) => [query, ...h.filter((q) => q !== query)].slice(0, 20));
      }
    } catch (e: any) {
      setError(e.message || "Network error — check your connection.");
    } finally {
      setRunning(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  };

  return (
    <div className="panel-stack" onKeyDown={onKeyDown}>
      <div className="sql-editor-shell">
        <div className="sql-editor-toolbar">
          <span className="sql-editor-hint">Runs as this database&apos;s own role — same access you&apos;d have via psql, nothing more.</span>
          <button className="button button-dark button-compact" onClick={run} disabled={running}>
            {running ? <span className="spinner spinner-dark" /> : <Play size={13} />}
            {running ? "Running…" : "Run"}
            <span style={{ opacity: 0.55, fontSize: 9 }}>⌘⏎</span>
          </button>
        </div>
        <CodeMirror
          className="sql-editor-cm"
          value={query}
          height="180px"
          theme="dark"
          extensions={[sql({ dialect: PostgreSQL })]}
          onChange={(value) => setQuery(value)}
        />
      </div>

      <div className="sql-editor-shell">
        <div className="sql-results">
          {running && (
            <div style={{ padding: 16 }}>
              <div className="skeleton skeleton-row" style={{ width: "34%", marginBottom: 12 }} />
              <div className="skeleton skeleton-row" style={{ width: "58%", marginBottom: 8 }} />
              <div className="skeleton skeleton-row" style={{ width: "48%", marginBottom: 8 }} />
              <div className="skeleton skeleton-row" style={{ width: "62%" }} />
            </div>
          )}
          {!running && error && <div className="sql-results-error">{error}</div>}
          {!running && !error && result && (
            <>
              <div className="sql-results-meta">
                <span>
                  {result.command} · {result.rowCount ?? result.rows.length} row
                  {(result.rowCount ?? result.rows.length) === 1 ? "" : "s"}
                  {result.truncated ? " (truncated at 500)" : ""}
                </span>
                <span>{result.durationMs} ms</span>
              </div>
              {result.rows.length === 0 ? (
                <div className="sql-results-empty">No rows returned.</div>
              ) : (
                <div className="sql-results-table-wrap">
                  <table className="sql-results-table">
                    <thead>
                      <tr>
                        {result.fields.map((f) => (
                          <th key={f}>{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.map((row, i) => (
                        <tr key={i}>
                          {result.fields.map((f) => {
                            const value = row[f];
                            return (
                              <td key={f} title={value === null || value === undefined ? "" : String(value)}>
                                {value === null || value === undefined ? (
                                  <em style={{ color: "var(--muted)", fontStyle: "normal" }}>null</em>
                                ) : (
                                  String(value)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {!running && !error && !result && (
            <div className="sql-results-empty">Run a query to see results here.</div>
          )}
        </div>
      </div>

      {history.length > 0 && (
        <section className="data-panel">
          <div className="panel-header">
            <div>
              <span className="label">HISTORY</span>
              <h3>Recent queries</h3>
            </div>
          </div>
          <div className="sql-history">
            {history.map((q, i) => (
              <button key={i} onClick={() => setQuery(q)} title="Load into editor">
                {q.replace(/\s+/g, " ")}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
