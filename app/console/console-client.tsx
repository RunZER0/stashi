"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Clipboard,
  Database,
  Gauge,
  HardDrive,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  makeConnectionString,
  type ActivityEntry,
  type Checkpoint,
  type ManagedDatabase,
  type Node,
} from "@/lib/control-plane";
import { getPlan, plans, type PlanId } from "@/lib/plans";
import { SqlEditor } from "./sql-editor";
import { CheckpointsPanel } from "./checkpoints-panel";

type Tab = "overview" | "sql" | "connection" | "agent" | "metrics" | "activity" | "backups" | "settings";

const TRANSIENT_STATUSES = new Set(["provisioning", "resizing"]);

const workspaceLabel = (email: string) => {
  const handle = email.split("@")[0] || "your";
  const name = handle.charAt(0).toUpperCase() + handle.slice(1);
  return `${name}'s workspace`;
};

export default function ConsoleClient({
  email,
  initialDatabases,
  initialActivity,
  primaryNode,
}: {
  email: string;
  initialDatabases: ManagedDatabase[];
  initialActivity: ActivityEntry[];
  primaryNode: Node | undefined;
}) {
  const [databases, setDatabases] = useState(initialDatabases);
  const [activity, setActivity] = useState(initialActivity);
  const [activeId, setActiveId] = useState<string | null>(initialDatabases[0]?.id ?? null);
  const [tab, setTab] = useState<Tab>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("new-app");
  const [newPlan, setNewPlan] = useState<PlanId>("starter");
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [busyAction, setBusyAction] = useState<"rotate" | "suspend" | "delete" | null>(null);

  const db = useMemo(() => databases.find((item) => item.id === activeId) ?? null, [databases, activeId]);
  const plan = db ? getPlan(db.plan) : null;
  const connectionString = db ? makeConnectionString(db) : "";

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const copy = async (value: string, label = "Copied") => {
    await navigator.clipboard.writeText(value);
    notify(label);
  };

  const refreshActivity = async () => {
    const response = await fetch("/api/activity");
    if (!response.ok) return;
    const payload = await response.json();
    setActivity(payload.activity ?? []);
  };

  const pollUntilSettled = async (id: string, settledMessage?: (status: string) => string) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      const response = await fetch("/api/databases");
      if (!response.ok) continue;
      const payload = await response.json();
      const list: ManagedDatabase[] = payload.databases ?? [];
      setDatabases(list);
      const match = list.find((item) => item.id === id);
      if (match && !TRANSIENT_STATUSES.has(match.status)) {
        await refreshActivity();
        notify(settledMessage ? settledMessage(match.status) : match.status === "healthy" ? "Database ready" : "Something went wrong — check Settings");
        return;
      }
    }
  };

  const createDatabase = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const response = await fetch("/api/databases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName, plan: newPlan, region: "us-east" }),
    });
    const payload = await response.json();
    setDatabases((current) => [payload.database, ...current]);
    setActiveId(payload.database.id);
    setTab("overview");
    setCreating(false);
    setCreateOpen(false);
    await refreshActivity();
    notify("Provisioning queued — waiting on the node agent");
    pollUntilSettled(payload.database.id);
  };

  const rotatePassword = async () => {
    if (!db) return;
    setBusyAction("rotate");
    try {
      const response = await fetch(`/api/databases/${db.id}/rotate`, { method: "POST" });
      const payload = await response.json();
      setDatabases((current) =>
        current.map((item) => (item.id === db.id ? { ...item, password: payload.password } : item))
      );
      setShowSecret(true);
      await refreshActivity();
      notify("Credentials rotated");
    } finally {
      setBusyAction(null);
    }
  };

  const toggleSuspend = async () => {
    if (!db) return;
    setBusyAction("suspend");
    try {
      const suspended = db.status !== "suspended";
      await fetch(`/api/databases/${db.id}/suspend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suspended }),
      });
      setDatabases((current) =>
        current.map((item) => (item.id === db.id ? { ...item, status: suspended ? "suspended" : "healthy" } : item))
      );
      await refreshActivity();
      notify(suspended ? "Database suspended" : "Database resumed");
    } finally {
      setBusyAction(null);
    }
  };

  const deleteDatabase = async () => {
    if (!db) return;
    if (!window.confirm(`Delete "${db.name}"? This cannot be undone.`)) return;
    setBusyAction("delete");
    try {
      await fetch(`/api/databases/${db.id}`, { method: "DELETE" });
      setDatabases((current) => {
        const next = current.filter((item) => item.id !== db.id);
        setActiveId(next[0]?.id ?? null);
        return next;
      });
      setTab("overview");
      await refreshActivity();
      notify("Database deleted");
    } finally {
      setBusyAction(null);
    }
  };

  const changePlan = async (newPlanId: PlanId) => {
    if (!db) return;
    setChangingPlan(true);
    const response = await fetch(`/api/databases/${db.id}/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: newPlanId }),
    });
    const payload = await response.json();
    setChangingPlan(false);
    if (!response.ok) {
      notify(payload.error || "Could not change plan");
      return;
    }
    setDatabases((current) => current.map((item) => (item.id === db.id ? payload.database : item)));
    setPlanChangeOpen(false);
    notify("Plan change queued — applying now");
    pollUntilSettled(db.id, (status) => (status === "healthy" ? "Plan updated" : "Plan change failed — check Activity"));
  };

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link href="/" className="brand">
            stashi<span className="brand-dot">.</span>
          </Link>
        </div>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{email.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{workspaceLabel(email)}</strong>
            <small>{email}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav className="side-nav">
          <button className="side-nav-active">
            <Database size={15} /> Databases <span>{databases.length}</span>
          </button>
          <button onClick={() => setTab("agent")} disabled={!db}>
            <Bot size={15} /> Agent &amp; MCP
          </button>
          <button onClick={() => setTab("activity")}>
            <Activity size={15} /> Activity
          </button>
          <Link href="/admin">
            <Server size={15} /> Operator Fleet
          </Link>
        </nav>
        <div className="sidebar-section-label">DATABASES</div>
        <div className="db-list">
          {databases.map((item) => (
            <button
              key={item.id}
              className={item.id === db?.id ? "db-list-active" : ""}
              onClick={() => {
                setActiveId(item.id);
                setTab("overview");
              }}
            >
              <span className={`db-led ${item.status}`} />
              <span>{item.name}</span>
              <small>{getPlan(item.plan).name}</small>
            </button>
          ))}
          {databases.length === 0 && <small style={{ color: "var(--muted)", padding: "8px" }}>None yet</small>}
        </div>
        <button className="sidebar-create" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> New database
        </button>
        <div className="sidebar-footer">
          <div className="capacity-mini">
            <div>
              <span>Workspace spend</span>
              <strong>${databases.reduce((sum, item) => sum + (getPlan(item.plan).price ?? 9), 0)} / mo</strong>
            </div>
            <small>Hard-capped · Zero loop overages.</small>
          </div>
          <form action="/api/logout" method="post">
            <button className="logout-link" type="submit">
              <ArrowLeft size={13} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <section className="console-main">
        <header className="console-topbar">
          <div className="breadcrumb">
            <span>Databases</span>
            <span>/</span>
            <strong>{db ? db.name : "—"}</strong>
          </div>
          <div className="console-actions">
            {db && (
              <span className={`status-pill status-${db.status}`}>
                <span className={`db-led ${db.status}`} />
                {db.status.toUpperCase()}
              </span>
            )}
            <button className="icon-button" aria-label="More actions">
              <MoreHorizontal size={16} />
            </button>
          </div>
        </header>

        <div className="console-content">
          {!db ? (
            <EmptyState onCreate={() => setCreateOpen(true)} />
          ) : (
            <>
              <div className="database-heading">
                <div>
                  <span className="mono section-index">
                    POSTGRESQL {db.version} · {db.region.toUpperCase()} ·{" "}
                    {db.tenancyMode === "pooled" ? "SHARED POOL, OWN SCHEMA" : "ISOLATED DATABASE"} · MCP READY
                  </span>
                  <h1>{db.name}</h1>
                  <p>
                    Created{" "}
                    {new Date(db.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · {plan!.name} plan (${plan!.price === null ? "9+" : plan!.price}/mo flat)
                  </p>
                </div>
                <button className="button button-dark button-compact" onClick={() => setCreateOpen(true)}>
                  <Plus size={15} /> Create database
                </button>
              </div>

              {db.status === "provisioning" && (
                <div className="data-panel" style={{ borderColor: "rgba(251, 191, 36, 0.35)", background: "var(--amber-soft)", padding: "14px 16px", marginBottom: "18px" }}>
                  <strong style={{ color: "var(--amber)", fontSize: "12px" }}>Provisioning on the node agent…</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                    The connection string below isn&apos;t live yet — it will start working once the node agent creates this role and database for real.
                  </p>
                </div>
              )}
              {db.status === "failed" && (
                <div className="data-panel" style={{ borderColor: "rgba(248, 113, 113, 0.35)", background: "var(--red-soft)", padding: "14px 16px", marginBottom: "18px" }}>
                  <strong style={{ color: "var(--red)", fontSize: "12px" }}>Provisioning failed</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                    The node agent couldn&apos;t create this database. Check Activity for details, or delete and retry.
                  </p>
                </div>
              )}
              {db.status === "resizing" && (
                <div className="data-panel" style={{ borderColor: "rgba(251, 191, 36, 0.35)", background: "var(--amber-soft)", padding: "14px 16px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "10px" }}>
                  <span className="spinner" />
                  <div>
                    <strong style={{ color: "var(--amber)", fontSize: "12px" }}>Applying a change on the node agent…</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--muted)" }}>
                      This settles automatically, usually within a few seconds.
                    </p>
                  </div>
                </div>
              )}

              <div className="tabs" role="tablist">
                {(["overview", "sql", "connection", "agent", "metrics", "activity", "backups", "settings"] as Tab[]).map(
                  (item) => (
                    <button key={item} className={tab === item ? "tab-active" : ""} onClick={() => setTab(item)}>
                      {item === "agent" ? "Agent & MCP" : item === "sql" ? "SQL Editor" : item}
                    </button>
                  )
                )}
              </div>

              {tab === "overview" && (
                <Overview db={db} plan={plan!} connectionString={connectionString} copy={copy} setTab={setTab} activity={activity} primaryNode={primaryNode} />
              )}
              {tab === "sql" &&
                (db.status === "healthy" ? (
                  <SqlEditor databaseId={db.id} />
                ) : (
                  <section className="data-panel" style={{ padding: "40px 20px", textAlign: "center", color: "var(--muted)", fontSize: "12px" }}>
                    The SQL editor needs this database to be healthy first.
                  </section>
                ))}
              {tab === "connection" && (
                <Connection
                  db={db}
                  connectionString={connectionString}
                  showSecret={showSecret}
                  setShowSecret={setShowSecret}
                  copy={copy}
                  rotatePassword={rotatePassword}
                  rotating={busyAction === "rotate"}
                />
              )}
              {tab === "agent" && (
                <AgentPanel db={db} plan={plan!} connectionString={connectionString} copy={copy} notify={notify} />
              )}
              {tab === "metrics" && <Metrics db={db} />}
              {tab === "activity" && <ActivityPanel activity={activity} />}
              {tab === "backups" && <CheckpointsPanel databaseId={db.id} notify={notify} />}
              {tab === "settings" && (
                <Settings
                  db={db}
                  plan={plan!}
                  toggleSuspend={toggleSuspend}
                  deleteDatabase={deleteDatabase}
                  suspending={busyAction === "suspend"}
                  deleting={busyAction === "delete"}
                  notify={notify}
                  onOpenPlanChange={() => setPlanChangeOpen(true)}
                />
              )}
            </>
          )}
        </div>
      </section>

      {createOpen && (
        <CreateModal
          name={newName}
          setName={setNewName}
          plan={newPlan}
          setPlan={setNewPlan}
          creating={creating}
          onClose={() => setCreateOpen(false)}
          onCreate={createDatabase}
        />
      )}
      {planChangeOpen && db && (
        <PlanChangeModal
          currentPlan={db.plan}
          changing={changingPlan}
          onClose={() => setPlanChangeOpen(false)}
          onChange={changePlan}
        />
      )}
      {toast && (
        <div className="toast">
          <Check size={15} />
          {toast}
        </div>
      )}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="data-panel" style={{ display: "grid", placeItems: "center", padding: "72px 24px", textAlign: "center", gap: "14px" }}>
      <Sparkles size={22} color="var(--green)" />
      <h2 style={{ margin: 0, fontSize: "22px" }}>No databases yet</h2>
      <p style={{ margin: 0, maxWidth: "420px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
        Create your first PostgreSQL database to get a TLS connection string, MCP credentials, and a live console.
      </p>
      <button className="button button-dark" onClick={onCreate}>
        <Plus size={15} /> Create database
      </button>
    </section>
  );
}

function Overview({
  db,
  plan,
  connectionString,
  copy,
  setTab,
  activity,
  primaryNode,
}: {
  db: ManagedDatabase;
  plan: ReturnType<typeof getPlan>;
  connectionString: string;
  copy: (v: string, l?: string) => void;
  setTab: (v: Tab) => void;
  activity: ActivityEntry[];
  primaryNode: Node | undefined;
}) {
  return (
    <div className="panel-stack">
      <div className="metric-grid">
        <Metric
          icon={<HardDrive size={16} />}
          label="Storage"
          value={`${db.storageUsedMb} MB`}
          sub={`of ${plan.storageGb} GB`}
          pct={Math.max(2, (db.storageUsedMb / (plan.storageGb * 1024)) * 100)}
        />
        <Metric
          icon={<Zap size={16} />}
          label="Connections"
          value={String(db.connections)}
          sub={`of ${plan.connections}`}
          pct={(db.connections / plan.connections) * 100}
        />
        <Metric
          icon={<Gauge size={16} />}
          label="P95 latency"
          value={db.p95LatencyMs === null ? "—" : `${db.p95LatencyMs} ms`}
          sub={db.p95LatencyMs === null ? "no traffic yet" : "last 60 minutes"}
          pct={db.p95LatencyMs === null ? 0 : Math.min(100, db.p95LatencyMs / 2)}
        />
        <Metric icon={<Bot size={16} />} label="Agent & MCP" value="Ready" sub="Guardrails active" pct={100} />
      </div>
      <div className="content-grid two-one">
        <section className="data-panel">
          <div className="panel-header">
            <div>
              <span className="label">CONNECT</span>
              <h3>Connection string</h3>
            </div>
            <button className="text-button" onClick={() => setTab("connection")}>
              Credentials →
            </button>
          </div>
          <div className="connection-box">
            <code>{connectionString.replace(/:[^:@]+@/, ":••••••••@")}</code>
            <button onClick={() => copy(connectionString, "Connection string copied")}>
              <Clipboard size={14} /> Copy
            </button>
          </div>
          <div className="quick-facts">
            <div>
              <span>Host</span>
              <strong>{db.host}</strong>
            </div>
            <div>
              <span>Port</span>
              <strong>{db.port}</strong>
            </div>
            <div>
              <span>SSL</span>
              <strong>Required</strong>
            </div>
          </div>
        </section>
        <section className="data-panel health-panel">
          <div className="panel-header">
            <div>
              <span className="label">HEALTH</span>
              <h3>Node pressure</h3>
            </div>
            <span className={`tiny-badge ${primaryNode?.capacityStatus === "open" ? "tiny-success" : ""}`}>
              {(primaryNode?.capacityStatus ?? "pending").toUpperCase()}
            </span>
          </div>
          <div className="pressure">
            <Pressure label="CPU" value={primaryNode?.cpuPct ?? null} />
            <Pressure label="Memory" value={primaryNode?.memoryPct ?? null} />
            <Pressure label="Disk" value={primaryNode?.diskPct ?? null} />
          </div>
          <p className="panel-footnote">
            {primaryNode?.lastHeartbeat
              ? `Last heartbeat ${new Date(primaryNode.lastHeartbeat).toLocaleTimeString()}. Hard-capped at $${plan.price ?? 9}/mo flat — immune to runaway loops.`
              : `Awaiting the first node agent heartbeat. Hard-capped at $${plan.price ?? 9}/mo flat — immune to runaway loops.`}
          </p>
        </section>
      </div>
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">RECENT ACTIVITY</span>
            <h3>What changed</h3>
          </div>
          <span className="mono muted">UTC</span>
        </div>
        {activity.length === 0 ? (
          <p className="panel-footnote">No activity yet. Actions you take will show up here.</p>
        ) : (
          <div className="event-list">
            {activity.slice(0, 4).map((entry) => (
              <Event
                key={entry.id}
                time={new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                title={entry.action}
                detail={entry.target}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Connection({
  db,
  connectionString,
  showSecret,
  setShowSecret,
  copy,
  rotatePassword,
  rotating,
}: {
  db: ManagedDatabase;
  connectionString: string;
  showSecret: boolean;
  setShowSecret: (v: boolean) => void;
  copy: (v: string, l?: string) => void;
  rotatePassword: () => void;
  rotating: boolean;
}) {
  const rows = [
    ["Host", db.host],
    ["Port", String(db.port)],
    ["Database", db.database],
    ["User", db.username],
    ["Password", showSecret ? db.password : "••••••••••••••••••••"],
    ["SSL mode", "require"],
  ];
  return (
    <div className="panel-stack">
      <section className="data-panel connection-primary">
        <div className="panel-header">
          <div>
            <span className="label">PRIMARY URL</span>
            <h3>Production connection</h3>
          </div>
          <span className="status-pill">
            <span className="status-dot" /> TLS REQUIRED
          </span>
        </div>
        <div className="big-code">
          <Terminal size={16} />
          <code>{showSecret ? connectionString : connectionString.replace(/:[^:@]+@/, ":••••••••@")}</code>
          <button onClick={() => copy(connectionString)}>
            <Clipboard size={14} />
          </button>
        </div>
        <div className="credential-table">
          {rows.map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <code>{v}</code>
              {k === "Password" ? (
                <button onClick={() => setShowSecret(!showSecret)}>{showSecret ? "Hide" : "Reveal"}</button>
              ) : (
                <button onClick={() => copy(v)}>Copy</button>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="data-panel danger-lite">
        <div>
          <KeyRound size={18} />
          <div>
            <h3>Rotate credentials</h3>
            <p>
              Generates a new password. Production provisioning updates PgBouncer auth atomically before retiring the old credential.
            </p>
          </div>
        </div>
        <button className="button button-ghost button-compact" onClick={rotatePassword} disabled={rotating}>
          {rotating ? <span className="spinner" /> : <RefreshCcw size={14} />}
          {rotating ? "Rotating…" : "Rotate"}
        </button>
      </section>
    </div>
  );
}

function AgentPanel({
  db,
  plan,
  connectionString,
  copy,
  notify,
}: {
  db: ManagedDatabase;
  plan: ReturnType<typeof getPlan>;
  connectionString: string;
  copy: (v: string, l?: string) => void;
  notify: (m: string) => void;
}) {
  const mcpConfig = JSON.stringify(
    {
      mcpServers: {
        stashi: {
          command: "npx",
          args: ["-y", "@stashi/mcp-server"],
          env: {
            STASHI_API_KEY: db.apiKey,
            STASHI_DATABASE_ID: db.id,
            STASHI_API_URL: typeof window !== "undefined" ? window.location.origin : "https://stashi.onrender.com",
            DATABASE_URL: connectionString,
          },
        },
      },
    },
    null,
    2
  );

  return (
    <div className="panel-stack">
      {/* MCP Quick Connect */}
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">MODEL CONTEXT PROTOCOL (MCP)</span>
            <h3>Claude Desktop, Cursor, &amp; Antigravity Config</h3>
          </div>
          <button
            className="button button-dark button-compact"
            onClick={() => copy(mcpConfig, "MCP Configuration copied to clipboard")}
          >
            <Clipboard size={14} /> Copy MCP Config
          </button>
        </div>
        <div className="big-code" style={{ padding: "18px", borderRadius: "0" }}>
          <Bot size={16} />
          <pre style={{ margin: 0, fontSize: "11px", color: "#a5caa9", overflowX: "auto" }}>{mcpConfig}</pre>
        </div>
        <p className="panel-footnote">
          Paste into your <code>claude_desktop_config.json</code> or Cursor / Windsurf settings. Allows your AI assistant to read schemas, run safe parameterized queries, and branch tables.
        </p>
      </section>

      {/* Autonomous Guardrails & Anti-Hallucination Controls */}
      <div className="content-grid two-one">
        <QuickCheckpoints db={db} notify={notify} />

        <section className="data-panel">
          <div className="panel-header">
            <div>
              <span className="label">FINANCIAL GUARDRAILS</span>
              <h3>Loop Protection</h3>
            </div>
            <span className="tiny-badge tiny-success">ACTIVE</span>
          </div>
          <div style={{ display: "grid", gap: "10px", fontSize: "11px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--muted)" }}>Plan Cap:</span>
              <strong>${plan.price ?? 9} / mo Flat</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--line)", paddingBottom: "8px" }}>
              <span style={{ color: "var(--muted)" }}>Loop Overages:</span>
              <strong style={{ color: "var(--green)" }}>0% (Immune)</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)" }}>Pool Concurrency:</span>
              <strong>{plan.connections} max</strong>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickCheckpoints({ db, notify }: { db: ManagedDatabase; notify: (m: string) => void }) {
  const [latest, setLatest] = useState<Checkpoint | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const load = async () => {
    const res = await fetch(`/api/databases/${db.id}/checkpoints`);
    if (!res.ok) return;
    const payload = await res.json();
    const ready = (payload.checkpoints as Checkpoint[] | undefined)?.find((c) => c.status === "ready");
    setLatest(ready ?? null);
  };

  useEffect(() => {
    load();
  }, [db.id]);

  const saveCheckpoint = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/databases/${db.id}/checkpoints`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "checkpoint", label: "Checkpoint" }),
      });
      if (res.ok) {
        notify("Checkpoint saving…");
        await load();
      } else {
        const payload = await res.json().catch(() => ({}));
        notify(payload.error || "Could not save checkpoint");
      }
    } finally {
      setSaving(false);
    }
  };

  const rollback = async () => {
    if (!latest) return;
    if (!window.confirm(`Roll back to "${latest.label}"? This overwrites all current data.`)) return;
    setRollingBack(true);
    try {
      const res = await fetch(`/api/databases/${db.id}/checkpoints/${latest.id}/restore`, { method: "POST" });
      if (res.ok) {
        notify("Rolling back…");
      } else {
        const payload = await res.json().catch(() => ({}));
        notify(payload.error || "Rollback failed to start");
      }
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <section className="data-panel">
      <div className="panel-header">
        <div>
          <span className="label">ANTI-HALLUCINATION CONTROLS</span>
          <h3>Schema Checkpoints</h3>
        </div>
        <span className="tiny-badge tiny-success">LIVE</span>
      </div>
      <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.6, margin: "0 0 16px" }}>
        Real point-in-time snapshots, not a queue promise — an agent (or you) can save one before a risky migration
        and roll back instantly if it goes wrong. Full history is in the Backups tab.
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button className="button button-ghost button-compact" onClick={saveCheckpoint} disabled={saving || db.status !== "healthy"}>
          {saving ? <span className="spinner" /> : <Check size={14} />}
          Save Checkpoint
        </button>
        <button
          className="button button-ghost button-compact"
          onClick={rollback}
          disabled={rollingBack || !latest || db.status !== "healthy"}
          title={latest ? latest.label : "No checkpoint yet"}
        >
          {rollingBack ? <span className="spinner" /> : <RotateCcw size={14} />}
          Rollback Last Checkpoint
        </button>
      </div>
    </section>
  );
}

function Metrics({ db }: { db: ManagedDatabase }) {
  return (
    <div className="panel-stack">
      <div className="metric-grid">
        <Metric
          icon={<Gauge size={16} />}
          label="P95 query"
          value={db.p95LatencyMs === null ? "—" : `${db.p95LatencyMs} ms`}
          sub={db.p95LatencyMs === null ? "no traffic yet" : "last 60 minutes"}
          pct={db.p95LatencyMs === null ? 0 : Math.min(100, db.p95LatencyMs / 2)}
        />
        <Metric icon={<Activity size={16} />} label="Queries / min" value="—" sub="no traffic yet" pct={0} />
        <Metric icon={<Zap size={16} />} label="Pool clients" value={String(db.connections)} sub="live connections" pct={(db.connections / 30) * 100} />
        <Metric icon={<HardDrive size={16} />} label="DB size" value={`${db.storageUsedMb} MB`} sub="updated on write" pct={19} />
      </div>
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">24 HOURS</span>
            <h3>Query throughput</h3>
          </div>
          <span className="tiny-badge tiny-warning">NOT CONNECTED</span>
        </div>
        <p className="panel-footnote">
          Query throughput charts populate once this database is attached to a live node reporting metrics. Nothing has been recorded yet.
        </p>
      </section>
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">SLOWEST BY TOTAL TIME</span>
            <h3>Query activity</h3>
          </div>
          <span className="tiny-badge tiny-warning">pg_stat_statements not connected</span>
        </div>
        <p className="panel-footnote">
          Query activity requires a live <code>pg_stat_statements</code> feed from the node agent. Not wired up yet.
        </p>
      </section>
    </div>
  );
}

function ActivityPanel({ activity }: { activity: ActivityEntry[] }) {
  return (
    <section className="data-panel">
      <div className="panel-header">
        <div>
          <span className="label">AUDIT LOG</span>
          <h3>Control-plane activity</h3>
        </div>
        <button className="button button-ghost button-compact">Export CSV</button>
      </div>
      {activity.length === 0 ? (
        <p className="panel-footnote">No activity yet. Actions you take across your databases show up here.</p>
      ) : (
        <div className="audit-list">
          {activity.map((entry) => (
            <Audit
              key={entry.id}
              actor={entry.actor}
              action={entry.action}
              target={entry.target}
              time={new Date(entry.createdAt).toLocaleString()}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Settings({
  db,
  plan,
  toggleSuspend,
  deleteDatabase,
  suspending,
  deleting,
  notify,
  onOpenPlanChange,
}: {
  db: ManagedDatabase;
  plan: ReturnType<typeof getPlan>;
  toggleSuspend: () => void;
  deleteDatabase: () => void;
  suspending: boolean;
  deleting: boolean;
  notify: (m: string) => void;
  onOpenPlanChange: () => void;
}) {
  return (
    <div className="panel-stack">
      <section className="data-panel">
        <div className="panel-header">
          <div>
            <span className="label">PLAN</span>
            <h3>
              {plan.name} · {plan.price === null ? "$9+" : `$${plan.price}`} / month
            </h3>
          </div>
          <button
            className="button button-ghost button-compact"
            onClick={onOpenPlanChange}
            disabled={db.status !== "healthy"}
          >
            Change plan
          </button>
        </div>
        <p className="settings-copy">
          Your bill stays fixed until you explicitly change plans. Switching plans updates connection limits on the
          node immediately; downgrades are blocked if you&apos;re already using more storage than the new plan allows.
        </p>
      </section>
      <section className="data-panel danger-zone">
        <div>
          <span className="label">DANGER ZONE</span>
          <h3>Lifecycle controls</h3>
          <p>
            Suspend blocks new client connections while preserving data. Delete removes this database record immediately.
          </p>
        </div>
        <div className="danger-actions">
          <button className="button button-ghost" onClick={toggleSuspend} disabled={suspending}>
            {suspending && <span className="spinner" />}
            {db.status === "suspended" ? "Resume database" : "Suspend database"}
          </button>
          <button className="button button-danger" onClick={deleteDatabase} disabled={deleting}>
            {deleting ? <span className="spinner" /> : <Trash2 size={14} />}
            Delete database
          </button>
        </div>
      </section>
    </div>
  );
}

function CreateModal({
  name,
  setName,
  plan,
  setPlan,
  creating,
  onClose,
  onCreate,
}: {
  name: string;
  setName: (v: string) => void;
  plan: PlanId;
  setPlan: (v: PlanId) => void;
  creating: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="create-modal">
        <div className="modal-title">
          <div>
            <span className="mono section-index">NEW DATABASE</span>
            <h2>Create PostgreSQL</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <label className="field-label">
          Database name
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <div className="field-label">
          Plan
          <div className="plan-picker">
            {plans.slice(0, 3).map((p) => (
              <button
                key={p.id}
                className={plan === p.id ? "plan-option-active" : ""}
                onClick={() => setPlan(p.id)}
              >
                <span>{p.name}</span>
                <strong>
                  ${p.price}
                  <small>/mo</small>
                </strong>
                <em>
                  {p.storageGb} GB · {p.connections} conns · {p.isolation}
                </em>
              </button>
            ))}
          </div>
        </div>
        <label className="field-label">
          Region
          <select defaultValue="us-east">
            <option value="us-east">US East · New Jersey</option>
          </select>
        </label>
        <div className="provision-preview">
          <span>
            <Server size={14} /> Shared node
          </span>
          <span>
            <ShieldCheck size={14} /> TLS required
          </span>
          <span>
            <Bot size={14} /> MCP enabled
          </span>
        </div>
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-dark" disabled={creating} onClick={onCreate}>
            {creating && <span className="spinner spinner-dark" />}
            {creating ? "Provisioning…" : "Create database"}{" "}
            {!creating && <ArrowLeft className="rotate-180" size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlanChangeModal({
  currentPlan,
  changing,
  onClose,
  onChange,
}: {
  currentPlan: PlanId;
  changing: boolean;
  onClose: () => void;
  onChange: (plan: PlanId) => void;
}) {
  const [selected, setSelected] = useState<PlanId>(currentPlan);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="create-modal">
        <div className="modal-title">
          <div>
            <span className="mono section-index">CHANGE PLAN</span>
            <h2>Pick a new plan</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="field-label">
          Plan
          <div className="plan-picker">
            {plans.slice(0, 3).map((p) => (
              <button
                key={p.id}
                className={selected === p.id ? "plan-option-active" : ""}
                onClick={() => setSelected(p.id)}
              >
                <span>
                  {p.name} {p.id === currentPlan ? "· current" : ""}
                </span>
                <strong>
                  ${p.price}
                  <small>/mo</small>
                </strong>
                <em>
                  {p.storageGb} GB · {p.connections} conns · {p.isolation}
                </em>
              </button>
            ))}
          </div>
        </div>
        <p className="settings-copy" style={{ marginTop: "14px" }}>
          Applying immediately updates the node&apos;s connection limit for this database. Downgrading below your
          current storage usage isn&apos;t allowed.
        </p>
        <div className="modal-actions">
          <button className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="button button-dark"
            disabled={changing || selected === currentPlan}
            onClick={() => onChange(selected)}
          >
            {changing ? <span className="spinner spinner-dark" /> : null}
            {changing ? "Applying…" : "Apply change"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  pct,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  pct: number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">
        {icon}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{sub}</small>
      <div className="metric-track">
        <i style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}

function Pressure({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div>
        <span>{label}</span>
        <strong>{value === null ? "—" : `${value}%`}</strong>
      </div>
      <div className="pressure-track">
        <i style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

function Event({ time, title, detail }: { time: string; title: string; detail: string }) {
  return (
    <div className="event-row">
      <span className="mono">{time}</span>
      <i className="event-dot" />
      <div>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}

function Audit({ actor, action, target, time }: { actor: string; action: string; target: string; time: string }) {
  return (
    <div className="audit-row">
      <div className="audit-avatar">{actor.slice(0, 1).toUpperCase()}</div>
      <div>
        <strong>{actor}</strong>
        <code>{action}</code>
        <span>{target}</span>
      </div>
      <time>{time}</time>
    </div>
  );
}
