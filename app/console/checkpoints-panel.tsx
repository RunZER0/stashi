"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Cloud, HardDrive, Plus, RotateCcw } from "lucide-react";
import type { Checkpoint } from "@/lib/control-plane";

const formatSize = (bytes: number | null) => {
  if (bytes === null) return "—";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function CheckpointsPanel({
  databaseId,
  notify,
}: {
  databaseId: string;
  notify: (m: string) => void;
}) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[] | null>(null);
  const [creating, setCreating] = useState<"checkpoint" | "backup" | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`/api/databases/${databaseId}/checkpoints`);
    if (!res.ok) return;
    const payload = await res.json();
    setCheckpoints(payload.checkpoints ?? []);
  };

  useEffect(() => {
    load();
  }, [databaseId]);

  // Poll while anything is still pending/restoring so the list settles on
  // its own — no dead spinners waiting for a manual refresh.
  useEffect(() => {
    if (!checkpoints) return;
    const inFlight = checkpoints.some((c) => c.status === "pending" || c.status === "restoring");
    if (!inFlight) return;
    const t = setTimeout(load, 2000);
    return () => clearTimeout(t);
  }, [checkpoints, databaseId]);

  const createCheckpoint = async (kind: "checkpoint" | "backup") => {
    setCreating(kind);
    try {
      const res = await fetch(`/api/databases/${databaseId}/checkpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, label: kind === "backup" ? "Manual backup" : "Checkpoint" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        notify(payload.error || "Could not start backup");
      } else {
        notify(kind === "backup" ? "Backup started" : "Checkpoint started");
        await load();
      }
    } finally {
      setCreating(null);
    }
  };

  const restore = async (checkpoint: Checkpoint) => {
    if (!window.confirm(`Restore "${checkpoint.label}"? This overwrites all current data with that snapshot.`)) return;
    setRestoringId(checkpoint.id);
    try {
      const res = await fetch(`/api/databases/${databaseId}/checkpoints/${checkpoint.id}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        notify(payload.error || "Restore failed to start");
      } else {
        notify("Restore started — this database will be briefly unavailable");
        await load();
      }
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="panel-stack">
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">SNAPSHOTS</span>
            <h3>Backups &amp; checkpoints</h3>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="button button-ghost button-compact"
              onClick={() => createCheckpoint("checkpoint")}
              disabled={creating !== null}
            >
              {creating === "checkpoint" ? <span className="spinner" /> : <Check size={14} />}
              Save checkpoint
            </button>
            <button
              className="button button-ghost button-compact"
              onClick={() => createCheckpoint("backup")}
              disabled={creating !== null}
            >
              {creating === "backup" ? <span className="spinner" /> : <Plus size={14} />}
              Backup now
            </button>
          </div>
        </div>

        {checkpoints === null ? (
          <div style={{ padding: "4px 0" }}>
            <div className="skeleton skeleton-row" style={{ width: "100%", marginBottom: 10 }} />
            <div className="skeleton skeleton-row" style={{ width: "100%", marginBottom: 10 }} />
            <div className="skeleton skeleton-row" style={{ width: "70%" }} />
          </div>
        ) : checkpoints.length === 0 ? (
          <p className="panel-footnote">
            No snapshots yet. Checkpoints are fast, node-local — meant for quick rollback during iterative changes.
            Backups additionally copy off-node to Backblaze B2.
          </p>
        ) : (
          <div>
            {checkpoints.map((c) => (
              <div className="checkpoint-row" key={c.id}>
                <div>
                  <span className={`checkpoint-kind ${c.kind === "backup" ? "kind-backup" : ""}`}>
                    {c.kind === "backup" ? "BACKUP" : c.kind === "auto" ? "AUTO-CHECKPOINT" : "CHECKPOINT"}
                  </span>
                  {c.kind === "backup" && c.status === "ready" && (
                    <span
                      className="tiny-badge"
                      style={{
                        marginLeft: "6px",
                        color: c.offNode ? "var(--green)" : "var(--muted)",
                        borderColor: c.offNode ? "rgba(52,211,153,.35)" : undefined,
                      }}
                      title={c.offNode ? "Copied off-node to Backblaze B2" : "Local only — off-node upload didn't complete"}
                    >
                      <Cloud size={9} style={{ marginRight: 3, verticalAlign: "-1px" }} />
                      {c.offNode ? "OFF-NODE" : "LOCAL ONLY"}
                    </span>
                  )}
                  <div style={{ marginTop: "5px", color: "var(--ink)" }}>{c.label}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--muted)" }}>
                  <Clock3 size={11} />
                  {formatTime(c.createdAt)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--muted)" }}>
                  <HardDrive size={11} />
                  {formatSize(c.sizeBytes)}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "8px" }}>
                  {c.status === "pending" && (
                    <span className="tiny-badge tiny-warning">
                      <span className="spinner" style={{ marginRight: 5 }} />
                      CREATING
                    </span>
                  )}
                  {c.status === "restoring" && (
                    <span className="tiny-badge tiny-warning">
                      <span className="spinner" style={{ marginRight: 5 }} />
                      RESTORING
                    </span>
                  )}
                  {c.status === "failed" && <span className="tiny-badge">FAILED</span>}
                  {c.status === "ready" && (
                    <button
                      className="button button-ghost button-compact"
                      onClick={() => restore(c)}
                      disabled={restoringId !== null}
                    >
                      {restoringId === c.id ? <span className="spinner" /> : <RotateCcw size={12} />}
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
