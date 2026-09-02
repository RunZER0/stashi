import Link from "next/link";
import { ArrowRight, Check, Database, Gauge, LockKeyhole, Terminal, Waves } from "lucide-react";
import { plans } from "@/lib/plans";

const proofRows = [
  ["payments-api", "Healthy", "842 MB", "38 ms"],
  ["student-portal", "Healthy", "126 MB", "24 ms"],
  ["inventory", "Healthy", "2.4 GB", "41 ms"],
];

export default function Home() {
  return (
    <main className="site-shell">
      <header className="topbar wrap">
        <Link className="brand" href="/">stashi<span className="brand-dot">.</span></Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#product">Product</a>
          <a href="#pricing">Pricing</a>
          <a href="#architecture">Architecture</a>
        </nav>
        <div className="top-actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <Link className="button button-dark button-compact" href="/login">Create database <ArrowRight size={15}/></Link>
        </div>
      </header>

      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span className="status-dot"/> Managed PostgreSQL · fixed monthly price</div>
          <h1>Postgres that costs what the label says.</h1>
          <p className="hero-lede">Production-ready PostgreSQL with TLS, pooling, backups and health monitoring. Start at $1. No compute-unit math. No surprise bill.</p>
          <div className="hero-actions">
            <Link className="button button-dark" href="/login">Create a database <ArrowRight size={16}/></Link>
            <a className="button button-ghost" href="#pricing">See pricing</a>
          </div>
          <div className="hero-facts" aria-label="Product facts">
            <span><Check size={14}/> PostgreSQL 17</span>
            <span><Check size={14}/> TLS by default</span>
            <span><Check size={14}/> Fixed pricing</span>
          </div>
        </div>

        <div className="instrument" aria-label="Stashi dashboard preview">
          <div className="instrument-topline">
            <div><span className="mini-mark"/> stashi / production</div>
            <span className="mono muted">US-EAST</span>
          </div>
          <div className="instrument-head">
            <div>
              <span className="label">DATABASE</span>
              <strong>payments-api</strong>
            </div>
            <span className="status-pill"><span className="status-dot"/> HEALTHY</span>
          </div>
          <div className="metric-strip">
            <div><span>STORAGE</span><strong>842 MB</strong><small>of 5 GB</small></div>
            <div><span>CONNECTIONS</span><strong>7</strong><small>of 30</small></div>
            <div><span>P95 LATENCY</span><strong>38 ms</strong><small>last 1h</small></div>
          </div>
          <div className="terminal-card">
            <div className="terminal-title"><Terminal size={13}/> CONNECTION</div>
            <code>postgresql://payments_owner:••••••@db.ynai.co.ke:6432/payments_api?sslmode=require</code>
            <button className="copy-chip">COPY</button>
          </div>
          <div className="table-head"><span>DATABASE</span><span>STATUS</span><span>STORAGE</span><span>P95</span></div>
          {proofRows.map((row) => (
            <div className="table-row" key={row[0]}>
              <span>{row[0]}</span><span className="healthy-text"><span className="status-dot"/>{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="signal-band" id="product">
        <div className="wrap signal-grid">
          <div className="signal-lead"><span className="mono">01</span><h2>The boring infrastructure is already handled.</h2></div>
          <div className="signal-item"><Database size={18}/><strong>Managed PostgreSQL</strong><p>Provisioned, isolated by role and routed through PgBouncer.</p></div>
          <div className="signal-item"><LockKeyhole size={18}/><strong>Secure by default</strong><p>TLS endpoints, strong credentials and raw Postgres kept private.</p></div>
          <div className="signal-item"><Gauge size={18}/><strong>Measured scaling</strong><p>Capacity grows when telemetry proves a bottleneck, not before.</p></div>
        </div>
      </section>

      <section className="wrap pricing-section" id="pricing">
        <div className="section-heading">
          <div><span className="mono section-index">02 / PRICING</span><h2>Small numbers. Clear limits.</h2></div>
          <p>Start where the workload is today. Move up when the metrics prove you need to.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`price-panel ${plan.recommended ? "price-featured" : ""}`} key={plan.id}>
              <div className="price-panel-top">
                <span className="plan-name">{plan.name}</span>
                {plan.recommended && <span className="tiny-badge">POPULAR</span>}
              </div>
              <div className="price"><strong>{plan.price === null ? "$9+" : `$${plan.price}`}</strong><span>/ month</span></div>
              <p>{plan.tagline}</p>
              <div className="price-spec"><span>Storage</span><strong>{plan.storageGb} GB</strong></div>
              <div className="price-spec"><span>Connections</span><strong>{plan.connections}</strong></div>
              <div className="price-spec"><span>Backups</span><strong>{plan.backupRetentionDays} day{plan.backupRetentionDays > 1 ? "s" : ""}</strong></div>
              <div className="price-spec"><span>Placement</span><strong>{plan.isolation}</strong></div>
              <Link href="/login" className="price-link">Choose {plan.name} <ArrowRight size={14}/></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-section" id="architecture">
        <div className="wrap architecture-grid">
          <div className="architecture-copy">
            <span className="mono section-index">03 / MECHANISM</span>
            <h2>A thin control plane over ordinary PostgreSQL.</h2>
            <p>Stashi keeps the architecture intentionally legible: shared nodes for small databases, dedicated nodes when isolation matters, and a scheduler that places workloads using real capacity.</p>
            <Link className="text-arrow" href="/login">Open the control plane <ArrowRight size={15}/></Link>
          </div>
          <div className="flow-diagram" aria-label="Provisioning flow">
            <div className="flow-node"><span>REQUEST</span><strong>Create database</strong><small>plan + region</small></div>
            <Waves className="flow-arrow" size={20}/>
            <div className="flow-node"><span>SCHEDULER</span><strong>Place workload</strong><small>CPU · RAM · disk</small></div>
            <Waves className="flow-arrow" size={20}/>
            <div className="flow-node"><span>NODE</span><strong>PostgreSQL 17</strong><small>PgBouncer + TLS</small></div>
          </div>
        </div>
      </section>

      <section className="wrap final-cta">
        <div><span className="status-dot"/> Provisioning available</div>
        <h2>Give your app a database.<br/>Keep the bill boring.</h2>
        <Link className="button button-light" href="/login">Create database <ArrowRight size={16}/></Link>
      </section>

      <footer className="wrap footer">
        <span className="brand">stashi<span className="brand-dot">.</span></span>
        <span>Managed PostgreSQL · built lean</span>
        <span>Kenya → global</span>
      </footer>
    </main>
  );
}
