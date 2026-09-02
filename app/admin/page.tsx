import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Database, HardDrive, Server, ShieldCheck, Users, Zap } from "lucide-react";
import { demoNodes } from "@/lib/control-plane";

const customers = [
  ["Victor's workspace", "2", "$4", "1.0 GB", "Healthy"],
  ["Acme Labs", "8", "$24", "6.8 GB", "Healthy"],
  ["Nairobi Dev", "5", "$11", "2.1 GB", "Healthy"],
  ["Kifaru Systems", "11", "$39", "14.7 GB", "Watch"],
];

export default async function AdminPage() {
  const session = (await cookies()).get("stashi_session")?.value;
  if (!session) redirect("/login");

  return <main className="operator-page">
    <header className="operator-header wrap-wide"><div><Link href="/console" className="back-link"><ArrowLeft size={14}/> Control plane</Link><h1>Operator</h1></div><div className="operator-status"><span className="status-dot"/> PLATFORM HEALTHY</div></header>
    <div className="wrap-wide operator-content">
      <section className="operator-metrics"><div><Server size={17}/><span>Nodes</span><strong>2</strong><small>1 open · 1 watch</small></div><div><Database size={17}/><span>Databases</span><strong>56</strong><small>+7 this week</small></div><div><Users size={17}/><span>Workspaces</span><strong>21</strong><small>17 paid</small></div><div><Zap size={17}/><span>Fixed MRR</span><strong>$146</strong><small>$24 infra cost</small></div></section>

      <section className="operator-section"><div className="section-heading compact"><div><span className="mono section-index">NODE CAPACITY</span><h2>Place by evidence.</h2></div><p>New databases go to the healthiest eligible node. Capacity limits are explicit rather than aspirational.</p></div><div className="node-grid">{demoNodes.map((node) => <article className="node-card" key={node.id}><div className="node-head"><div><span className="node-icon"><Server size={16}/></span><div><strong>{node.label}</strong><small>{node.region}</small></div></div><span className={`tiny-badge ${node.capacityStatus === "open" ? "tiny-success" : "tiny-warning"}`}>{node.capacityStatus.toUpperCase()}</span></div><div className="node-stat"><span>CPU</span><strong>{node.cpuPct}%</strong><div className="node-bar"><i style={{ width: `${node.cpuPct}%` }}/><b style={{ left: "60%" }}/></div></div><div className="node-stat"><span>Memory</span><strong>{node.memoryPct}%</strong><div className="node-bar"><i style={{ width: `${node.memoryPct}%` }}/><b style={{ left: "75%" }}/></div></div><div className="node-stat"><span>Disk</span><strong>{node.diskPct}%</strong><div className="node-bar"><i style={{ width: `${node.diskPct}%` }}/><b style={{ left: "70%" }}/></div></div><div className="node-foot"><span><Database size={13}/>{node.databaseCount} DBs</span><span><HardDrive size={13}/>40 GB node</span></div></article>)}</div></section>

      <section className="operator-section"><div className="panel-header"><div><span className="label">CUSTOMER QUOTAS</span><h3>Workspaces</h3></div><span className="mono muted">FIXED-PRICE MODEL</span></div><div className="customer-table"><div className="customer-head"><span>WORKSPACE</span><span>DATABASES</span><span>MRR</span><span>STORAGE</span><span>HEALTH</span></div>{customers.map((c) => <div className="customer-row" key={c[0]}><strong>{c[0]}</strong><span>{c[1]}</span><span>{c[2]}</span><span>{c[3]}</span><span className={c[4] === "Healthy" ? "healthy-text" : "warning-text"}><span className="status-dot"/>{c[4]}</span></div>)}</div></section>

      <section className="operator-grid"><article className="operator-note"><ShieldCheck size={18}/><div><span className="label">PLACEMENT LAW</span><h3>No invisible autoscaling.</h3><p>Keep a node open while CPU &lt; 60%, memory &lt; 75% and disk &lt; 70%. Recommend an upgrade only after sustained pressure or query evidence proves the need.</p></div></article><article className="operator-note"><Zap size={18}/><div><span className="label">UNIT ECONOMICS</span><h3>$24 infra → $146 MRR</h3><p>The admin view makes node density, customer quotas and infrastructure margin visible before the system becomes complicated.</p></div></article></section>
    </div>
  </main>;
}
