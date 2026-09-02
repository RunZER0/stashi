"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Check, ChevronDown, Clipboard, Clock3, Database, Gauge, HardDrive, KeyRound, MoreHorizontal, Plus, RefreshCcw, RotateCcw, Server, ShieldCheck, Terminal, Trash2, X, Zap } from "lucide-react";
import { demoDatabases, makeConnectionString, type ManagedDatabase } from "@/lib/control-plane";
import { getPlan, plans, type PlanId } from "@/lib/plans";

type Tab = "overview" | "connection" | "metrics" | "activity" | "backups" | "settings";

const backups = [
  { id: "bk_0902_0200", created: "Today, 02:00 UTC", size: "521 MB", status: "Verified" },
  { id: "bk_0901_0200", created: "Sep 1, 02:00 UTC", size: "518 MB", status: "Verified" },
  { id: "bk_0831_0200", created: "Aug 31, 02:00 UTC", size: "516 MB", status: "Verified" },
];

const queries = [
  ["SELECT id, status FROM payments WHERE user_id = $1", "1,824", "18.7 ms", "34.1 s"],
  ["UPDATE sessions SET last_seen_at = now() WHERE id = $1", "921", "11.4 ms", "10.5 s"],
  ["SELECT * FROM invoices WHERE account_id = $1 ORDER BY created_at DESC", "448", "16.6 ms", "7.4 s"],
  ["INSERT INTO audit_log (actor_id, action, payload) VALUES ($1, $2, $3)", "311", "6.1 ms", "1.9 s"],
];

export default function ConsoleClient({ email }: { email: string }) {
  const [databases, setDatabases] = useState(demoDatabases);
  const [activeId, setActiveId] = useState(demoDatabases[0].id);
  const [tab, setTab] = useState<Tab>("overview");
  const [createOpen, setCreateOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("new-app");
  const [newPlan, setNewPlan] = useState<PlanId>("starter");

  const db = useMemo(() => databases.find((item) => item.id === activeId) ?? databases[0], [databases, activeId]);
  const plan = getPlan(db.plan);
  const connectionString = makeConnectionString(db);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  const copy = async (value: string, label = "Copied") => {
    await navigator.clipboard.writeText(value);
    notify(label);
  };

  const createDatabase = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const response = await fetch("/api/databases", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newName, plan: newPlan, region: "us-east" }) });
    const payload = await response.json();
    setDatabases((current) => [payload.database, ...current]);
    setActiveId(payload.database.id);
    setTab("connection");
    setCreating(false);
    setCreateOpen(false);
    notify("Database provisioned");
  };

  const rotatePassword = async () => {
    const response = await fetch(`/api/databases/${db.id}/rotate`, { method: "POST" });
    const payload = await response.json();
    setDatabases((current) => current.map((item) => item.id === db.id ? { ...item, password: payload.password } : item));
    setShowSecret(true);
    notify("Credentials rotated");
  };

  const toggleSuspend = async () => {
    const suspended = db.status !== "suspended";
    await fetch(`/api/databases/${db.id}/suspend`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ suspended }) });
    setDatabases((current) => current.map((item) => item.id === db.id ? { ...item, status: suspended ? "suspended" : "healthy" } : item));
    notify(suspended ? "Database suspended" : "Database resumed");
  };

  return (
    <main className="console-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><Link href="/" className="brand">stashi<span className="brand-dot">.</span></Link><span className="env-chip">MVP</span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">V</span><div><strong>Victor&apos;s workspace</strong><small>{email}</small></div><ChevronDown size={14}/></div>
        <nav className="side-nav">
          <button className="side-nav-active"><Database size={15}/> Databases <span>{databases.length}</span></button>
          <button><Activity size={15}/> Activity</button>
          <Link href="/admin"><Server size={15}/> Operator</Link>
        </nav>
        <div className="sidebar-section-label">DATABASES</div>
        <div className="db-list">
          {databases.map((item) => <button key={item.id} className={item.id === db.id ? "db-list-active" : ""} onClick={() => { setActiveId(item.id); setTab("overview"); }}><span className={`db-led ${item.status}`}/><span>{item.name}</span><small>{getPlan(item.plan).name}</small></button>)}
        </div>
        <button className="sidebar-create" onClick={() => setCreateOpen(true)}><Plus size={14}/> New database</button>
        <div className="sidebar-footer"><div className="capacity-mini"><div><span>Workspace spend</span><strong>${databases.reduce((sum, item) => sum + (getPlan(item.plan).price ?? 9), 0)} / mo</strong></div><div className="capacity-track"><i style={{ width: "28%" }}/></div><small>Fixed until you change a plan.</small></div><form action="/api/logout" method="post"><button className="logout-link" type="submit"><ArrowLeft size={13}/> Sign out</button></form></div>
      </aside>

      <section className="console-main">
        <header className="console-topbar">
          <div className="breadcrumb"><span>Databases</span><span>/</span><strong>{db.name}</strong></div>
          <div className="console-actions"><span className={`status-pill ${db.status === "suspended" ? "status-suspended" : ""}`}><span className={`db-led ${db.status}`}/>{db.status.toUpperCase()}</span><button className="icon-button" aria-label="More actions"><MoreHorizontal size={16}/></button></div>
        </header>

        <div className="console-content">
          <div className="database-heading">
            <div><span className="mono section-index">POSTGRESQL {db.version} · {db.region.toUpperCase()}</span><h1>{db.name}</h1><p>Created {new Date(db.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {plan.name} plan</p></div>
            <button className="button button-dark button-compact" onClick={() => setCreateOpen(true)}><Plus size={15}/> Create database</button>
          </div>

          <div className="tabs" role="tablist">
            {(["overview", "connection", "metrics", "activity", "backups", "settings"] as Tab[]).map((item) => <button key={item} className={tab === item ? "tab-active" : ""} onClick={() => setTab(item)}>{item}</button>)}
          </div>

          {tab === "overview" && <Overview db={db} plan={plan} connectionString={connectionString} copy={copy} setTab={setTab}/>} 
          {tab === "connection" && <Connection db={db} connectionString={connectionString} showSecret={showSecret} setShowSecret={setShowSecret} copy={copy} rotatePassword={rotatePassword}/>} 
          {tab === "metrics" && <Metrics db={db}/>} 
          {tab === "activity" && <ActivityPanel/>}
          {tab === "backups" && <Backups notify={notify}/>} 
          {tab === "settings" && <Settings db={db} plan={plan} toggleSuspend={toggleSuspend} notify={notify}/>} 
        </div>
      </section>

      {createOpen && <CreateModal name={newName} setName={setNewName} plan={newPlan} setPlan={setNewPlan} creating={creating} onClose={() => setCreateOpen(false)} onCreate={createDatabase}/>} 
      {toast && <div className="toast"><Check size={15}/>{toast}</div>}
    </main>
  );
}

function Overview({ db, plan, connectionString, copy, setTab }: { db: ManagedDatabase; plan: ReturnType<typeof getPlan>; connectionString: string; copy: (v: string, l?: string) => void; setTab: (v: Tab) => void }) {
  return <div className="panel-stack">
    <div className="metric-grid">
      <Metric icon={<HardDrive size={16}/>} label="Storage" value={`${db.storageUsedMb} MB`} sub={`of ${plan.storageGb} GB`} pct={Math.max(2, (db.storageUsedMb / (plan.storageGb * 1024)) * 100)}/>
      <Metric icon={<Zap size={16}/>} label="Connections" value={String(db.connections)} sub={`of ${plan.connections}`} pct={(db.connections / plan.connections) * 100}/>
      <Metric icon={<Gauge size={16}/>} label="P95 latency" value={`${db.p95LatencyMs} ms`} sub="last 60 minutes" pct={Math.min(100, db.p95LatencyMs / 2)}/>
      <Metric icon={<ShieldCheck size={16}/>} label="Backups" value="Verified" sub={`${plan.backupRetentionDays} day retention`} pct={100}/>
    </div>
    <div className="content-grid two-one">
      <section className="data-panel"><div className="panel-header"><div><span className="label">CONNECT</span><h3>Connection string</h3></div><button className="text-button" onClick={() => setTab("connection")}>Credentials →</button></div><div className="connection-box"><code>{connectionString.replace(/:[^:@]+@/, ":••••••••@")}</code><button onClick={() => copy(connectionString, "Connection string copied")}><Clipboard size={14}/> Copy</button></div><div className="quick-facts"><div><span>Host</span><strong>{db.host}</strong></div><div><span>Port</span><strong>{db.port}</strong></div><div><span>SSL</span><strong>Required</strong></div></div></section>
      <section className="data-panel health-panel"><div className="panel-header"><div><span className="label">HEALTH</span><h3>Node pressure</h3></div><span className="tiny-badge tiny-success">NORMAL</span></div><div className="pressure"><Pressure label="CPU" value={34}/><Pressure label="Memory" value={61}/><Pressure label="Disk" value={23}/></div><p className="panel-footnote">No scale action recommended. Stashi upgrades capacity only after measured saturation.</p></section>
    </div>
    <section className="data-panel"><div className="panel-header"><div><span className="label">RECENT ACTIVITY</span><h3>What changed</h3></div><span className="mono muted">UTC</span></div><div className="event-list"><Event time="14:26" title="Health check passed" detail="TLS endpoint and pooled connection verified"/><Event time="13:02" title="Backup completed" detail="521 MB · checksum verified"/><Event time="09:41" title="Connection peak" detail="12 concurrent clients · pool remained healthy"/></div></section>
  </div>;
}

function Connection({ db, connectionString, showSecret, setShowSecret, copy, rotatePassword }: { db: ManagedDatabase; connectionString: string; showSecret: boolean; setShowSecret: (v: boolean) => void; copy: (v: string, l?: string) => void; rotatePassword: () => void }) {
  const rows = [["Host", db.host], ["Port", String(db.port)], ["Database", db.database], ["User", db.username], ["Password", showSecret ? db.password : "••••••••••••••••••••"], ["SSL mode", "require"]];
  return <div className="panel-stack"><section className="data-panel connection-primary"><div className="panel-header"><div><span className="label">PRIMARY URL</span><h3>Production connection</h3></div><span className="status-pill"><span className="status-dot"/> TLS REQUIRED</span></div><div className="big-code"><Terminal size={16}/><code>{showSecret ? connectionString : connectionString.replace(/:[^:@]+@/, ":••••••••@")}</code><button onClick={() => copy(connectionString)}><Clipboard size={14}/></button></div><div className="credential-table">{rows.map(([k,v]) => <div key={k}><span>{k}</span><code>{v}</code>{k === "Password" ? <button onClick={() => setShowSecret(!showSecret)}>{showSecret ? "Hide" : "Reveal"}</button> : <button onClick={() => copy(v)}>Copy</button>}</div>)}</div></section><section className="data-panel danger-lite"><div><KeyRound size={18}/><div><h3>Rotate credentials</h3><p>Generates a new password. Production provisioning would update PgBouncer auth atomically before retiring the old credential.</p></div></div><button className="button button-ghost button-compact" onClick={rotatePassword}><RefreshCcw size={14}/> Rotate</button></section></div>;
}

function Metrics({ db }: { db: ManagedDatabase }) {
  const bars = [22, 31, 18, 42, 36, 58, 47, 69, 52, 44, 38, 35, 49, 34, 28, 41, 37, 33, 46, 39, 31, 34, 29, 34];
  return <div className="panel-stack"><div className="metric-grid"><Metric icon={<Gauge size={16}/>} label="P95 query" value={`${db.p95LatencyMs} ms`} sub="−8% from yesterday" pct={32}/><Metric icon={<Activity size={16}/>} label="Queries / min" value="184" sub="peak 312" pct={58}/><Metric icon={<Zap size={16}/>} label="Pool clients" value="7" sub="20 server connections" pct={35}/><Metric icon={<HardDrive size={16}/>} label="DB size" value={`${db.storageUsedMb} MB`} sub="+14 MB / day" pct={19}/></div><section className="data-panel"><div className="panel-header"><div><span className="label">24 HOURS</span><h3>Query throughput</h3></div><span className="mono muted">AVG 164 QPM</span></div><div className="bar-chart" aria-label="24 hour query throughput chart">{bars.map((h, i) => <i key={i} style={{ height: `${h}%` }}/>)}</div><div className="chart-axis"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>NOW</span></div></section><section className="data-panel"><div className="panel-header"><div><span className="label">SLOWEST BY TOTAL TIME</span><h3>Query activity</h3></div><span className="tiny-badge">pg_stat_statements</span></div><div className="query-table"><div className="query-head"><span>QUERY</span><span>CALLS</span><span>MEAN</span><span>TOTAL</span></div>{queries.map((q) => <div className="query-row" key={q[0]}><code>{q[0]}</code><span>{q[1]}</span><span>{q[2]}</span><span>{q[3]}</span></div>)}</div></section></div>;
}

function ActivityPanel() { return <section className="data-panel"><div className="panel-header"><div><span className="label">AUDIT LOG</span><h3>Control-plane activity</h3></div><button className="button button-ghost button-compact">Export CSV</button></div><div className="audit-list"><Audit actor="you" action="database.credentials.viewed" target="payments-api" time="2 minutes ago"/><Audit actor="system" action="backup.verified" target="payments-api / bk_0902_0200" time="12 hours ago"/><Audit actor="you" action="database.created" target="payments-api" time="1 day ago"/><Audit actor="scheduler" action="database.placed" target="node-nj-01" time="1 day ago"/></div></section>; }

function Backups({ notify }: { notify: (m: string) => void }) { return <div className="panel-stack"><section className="data-panel backup-hero"><div><span className="label">BACKUP POLICY</span><h3>Automatic, verified, off-node.</h3><p>Backups are encrypted, uploaded to object storage, checksum-verified, then rotated according to the plan&apos;s retention window.</p></div><div className="backup-stat"><span>NEXT BACKUP</span><strong>02:00 UTC</strong><small>in 11h 34m</small></div></section><section className="data-panel"><div className="panel-header"><div><span className="label">RESTORE POINTS</span><h3>Available backups</h3></div><button className="button button-ghost button-compact" onClick={() => notify("On-demand backup queued")}><Plus size={14}/> Backup now</button></div><div className="backup-table"><div className="backup-head"><span>CREATED</span><span>SIZE</span><span>STATUS</span><span/></div>{backups.map((b) => <div className="backup-row" key={b.id}><div><Clock3 size={14}/><span>{b.created}</span><small>{b.id}</small></div><span>{b.size}</span><span className="healthy-text"><span className="status-dot"/>{b.status}</span><button onClick={() => notify(`Restore queued from ${b.created}`)}><RotateCcw size={14}/> Restore</button></div>)}</div></section></div>; }

function Settings({ db, plan, toggleSuspend, notify }: { db: ManagedDatabase; plan: ReturnType<typeof getPlan>; toggleSuspend: () => void; notify: (m: string) => void }) { return <div className="panel-stack"><section className="data-panel"><div className="panel-header"><div><span className="label">PLAN</span><h3>{plan.name} · {plan.price === null ? "$9+" : `$${plan.price}`} / month</h3></div><button className="button button-ghost button-compact" onClick={() => notify("Plan selector opened")}>Change plan</button></div><p className="settings-copy">Your bill stays fixed until you explicitly change plans. Capacity alerts recommend an upgrade; they never perform one silently.</p></section><section className="data-panel danger-zone"><div><span className="label">DANGER ZONE</span><h3>Lifecycle controls</h3><p>Suspend blocks new client connections while preserving data. Delete requires a final explicit confirmation in production.</p></div><div className="danger-actions"><button className="button button-ghost" onClick={toggleSuspend}>{db.status === "suspended" ? "Resume database" : "Suspend database"}</button><button className="button button-danger" onClick={() => notify("Delete requires typed confirmation")}><Trash2 size={14}/> Delete database</button></div></section></div>; }

function CreateModal({ name, setName, plan, setPlan, creating, onClose, onCreate }: { name: string; setName: (v: string) => void; plan: PlanId; setPlan: (v: PlanId) => void; creating: boolean; onClose: () => void; onCreate: () => void }) { return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="create-modal"><div className="modal-title"><div><span className="mono section-index">NEW DATABASE</span><h2>Create PostgreSQL</h2></div><button className="icon-button" onClick={onClose}><X size={16}/></button></div><label className="field-label">Database name<input value={name} onChange={(e) => setName(e.target.value)} autoFocus/></label><div className="field-label">Plan<div className="plan-picker">{plans.slice(0,3).map((p) => <button key={p.id} className={plan === p.id ? "plan-option-active" : ""} onClick={() => setPlan(p.id)}><span>{p.name}</span><strong>${p.price}<small>/mo</small></strong><em>{p.storageGb} GB · {p.connections} conns</em></button>)}</div></div><label className="field-label">Region<select defaultValue="us-east"><option value="us-east">US East · New Jersey</option></select></label><div className="provision-preview"><span><Server size={14}/> Shared node</span><span><ShieldCheck size={14}/> TLS required</span><span><Clock3 size={14}/> Seconds to provision</span></div><div className="modal-actions"><button className="button button-ghost" onClick={onClose}>Cancel</button><button className="button button-dark" disabled={creating} onClick={onCreate}>{creating ? "Provisioning…" : "Create database"} {!creating && <ArrowLeft className="rotate-180" size={15}/>}</button></div></div></div>; }

function Metric({ icon, label, value, sub, pct }: { icon: ReactNode; label: string; value: string; sub: string; pct: number }) { return <div className="metric-card"><div className="metric-label">{icon}<span>{label}</span></div><strong>{value}</strong><small>{sub}</small><div className="metric-track"><i style={{ width: `${Math.max(2, Math.min(100, pct))}%` }}/></div></div>; }
function Pressure({ label, value }: { label: string; value: number }) { return <div><div><span>{label}</span><strong>{value}%</strong></div><div className="pressure-track"><i style={{ width: `${value}%` }}/><b style={{ left: "75%" }}/></div></div>; }
function Event({ time, title, detail }: { time: string; title: string; detail: string }) { return <div className="event-row"><span className="mono">{time}</span><i className="event-dot"/><div><strong>{title}</strong><p>{detail}</p></div></div>; }
function Audit({ actor, action, target, time }: { actor: string; action: string; target: string; time: string }) { return <div className="audit-row"><div className="audit-avatar">{actor.slice(0,1).toUpperCase()}</div><div><strong>{actor}</strong><code>{action}</code><span>{target}</span></div><time>{time}</time></div>; }
