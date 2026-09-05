import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock3, Database, Server, ShieldCheck, Users, Zap } from "lucide-react";
import { adminSummary } from "@/lib/store";
import { getPlan } from "@/lib/plans";
import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const summary = await adminSummary();
  const fixedMrr = summary.workspaces.reduce(
    (sum, w) => sum + w.databases.reduce((s, db) => s + (getPlan(db.plan).price ?? 9), 0),
    0
  );
  const openNodes = summary.nodes.filter((n) => n.capacityStatus === "open").length;
  const watchNodes = summary.nodes.filter((n) => n.capacityStatus === "watch").length;
  const pendingNodes = summary.nodes.filter((n) => n.capacityStatus === "pending").length;

  return (
    <main className="operator-page">
      <header className="operator-header wrap-wide">
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <Link href="/" className="brand" aria-label="Stashi home">
            <img src="/stashi-logo-light.png" alt="Stashi" height={32} style={{ height: "32px", width: "auto", display: "block" }} />
          </Link>
          <div>
            <Link href="/console" className="back-link"><ArrowLeft size={14}/> Control plane</Link>
            <h1>Operator Fleet &amp; Quotas</h1>
          </div>
        </div>
        <div className="operator-status"><span className="status-dot"/> {pendingNodes === summary.nodes.length ? "NO NODES REPORTING YET" : "PLATFORM HEALTHY"}</div>
      </header>
      <div className="wrap-wide operator-content">
        <section className="operator-metrics">
          <div><Server size={17}/><span>Nodes</span><strong>{summary.nodes.length}</strong><small>{openNodes} open · {watchNodes} watch · {pendingNodes} pending</small></div>
          <div><Database size={17}/><span>Databases</span><strong>{summary.totalDatabases}</strong><small>across all workspaces</small></div>
          <div><Users size={17}/><span>Workspaces</span><strong>{summary.workspaceCount}</strong><small>{summary.workspaces.filter((w) => w.databases.length > 0).length} with databases</small></div>
          <div><Zap size={17}/><span>Fixed MRR</span><strong>${fixedMrr}</strong><small>sum of active plan prices</small></div>
        </section>

        <section className="operator-section">
          <div className="section-heading compact">
            <div><span className="mono section-index">NODE CAPACITY</span><h2>Place by evidence.</h2></div>
            <p>New databases go to the healthiest eligible node. Capacity limits are explicit rather than aspirational.</p>
          </div>
          <div className="node-grid">
            {summary.nodes.map((node) => (
              <article className="node-card" key={node.id}>
                <div className="node-head">
                  <div>
                    <span className="node-icon"><Server size={16}/></span>
                    <div><strong>{node.label}</strong><small>{node.region}</small></div>
                  </div>
                  <span className={`tiny-badge ${node.capacityStatus === "open" ? "tiny-success" : node.capacityStatus === "watch" ? "tiny-warning" : ""}`}>
                    {node.capacityStatus.toUpperCase()}
                  </span>
                </div>
                <div className="node-stat">
                  <span>CPU</span><strong>{node.cpuPct === null ? "—" : `${node.cpuPct}%`}</strong>
                  <div className="node-bar"><i style={{ width: `${node.cpuPct ?? 0}%` }}/></div>
                </div>
                <div className="node-stat">
                  <span>Memory</span><strong>{node.memoryPct === null ? "—" : `${node.memoryPct}%`}</strong>
                  <div className="node-bar"><i style={{ width: `${node.memoryPct ?? 0}%` }}/></div>
                </div>
                <div className="node-stat">
                  <span>Disk</span><strong>{node.diskPct === null ? "—" : `${node.diskPct}%`}</strong>
                  <div className="node-bar"><i style={{ width: `${node.diskPct ?? 0}%` }}/></div>
                </div>
                <div className="node-foot">
                  <span><Database size={13}/>{node.databaseCount} DBs</span>
                  <span><Clock3 size={13}/>{node.lastHeartbeat ? `Last heartbeat ${new Date(node.lastHeartbeat).toLocaleTimeString()}` : "No heartbeat yet"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="operator-section">
          <div className="panel-header"><div><span className="label">CUSTOMER QUOTAS</span><h3>Workspaces</h3></div><span className="mono muted">FIXED-PRICE MODEL</span></div>
          {summary.workspaces.length === 0 ? (
            <p className="panel-footnote">No one has signed in yet.</p>
          ) : (
            <div className="customer-table">
              <div className="customer-head"><span>WORKSPACE</span><span>DATABASES</span><span>MRR</span><span>STORAGE</span></div>
              {summary.workspaces.map((w) => {
                const mrr = w.databases.reduce((s, db) => s + (getPlan(db.plan).price ?? 9), 0);
                const storageMb = w.databases.reduce((s, db) => s + db.storageUsedMb, 0);
                return (
                  <div className="customer-row" key={w.email}>
                    <strong>{w.email}</strong>
                    <span>{w.databases.length}</span>
                    <span>${mrr}</span>
                    <span>{(storageMb / 1024).toFixed(2)} GB</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="operator-grid">
          <article className="operator-note">
            <ShieldCheck size={18}/>
            <div><span className="label">PLACEMENT LAW</span><h3>No invisible autoscaling.</h3><p>Keep a node open while CPU &lt; 60%, memory &lt; 75% and disk &lt; 70%. Recommend an upgrade only after sustained pressure or query evidence proves the need.</p></div>
          </article>
          <article className="operator-note">
            <Zap size={18}/>
            <div><span className="label">UNIT ECONOMICS</span><h3>${fixedMrr} MRR</h3><p>The admin view makes node density, customer quotas and infrastructure margin visible before the system becomes complicated.</p></div>
          </article>
        </section>
      </div>
    </main>
  );
}
