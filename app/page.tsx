import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <main className="mk-shell">
      <SiteHeader />

      <section className="mk-wrap mk-hero">
        <div className="mk-hero-copy">
          <span className="mk-kicker">Managed PostgreSQL</span>
          <h1>A production Postgres database from $1 a month.</h1>
          <p>Create a database and get a TLS connection string in seconds. Every plan has a fixed monthly price and limits you can see before you deploy.</p>
          <div className="mk-hero-actions">
            <Link className="mk-button mk-button-dark" href="/login">Create database <ArrowRight size={16} /></Link>
            <Link className="mk-button mk-button-quiet" href="/pricing">View pricing</Link>
          </div>
          <div className="mk-proofline" aria-label="Platform details">
            <span><i /> PostgreSQL 17</span>
            <span><i /> TLS endpoint</span>
            <span><i /> PgBouncer pooling</span>
            <span><i /> fixed plan limits</span>
          </div>
        </div>

        <div className="mk-console mk-noise" aria-label="Database dashboard preview">
          <div className="mk-console-bar"><span>STASHI / DATABASE</span><b>HEALTHY</b></div>
          <div className="mk-console-head">
            <div><span>DATABASE</span><strong>payments-api</strong></div>
            <div className="mk-health">ONLINE</div>
          </div>
          <div className="mk-metrics">
            <div><span>STORAGE</span><strong>842 MB</strong><small>5 GB limit</small></div>
            <div><span>CONNECTIONS</span><strong>7</strong><small>30 limit</small></div>
            <div><span>P95 LATENCY</span><strong>38 ms</strong><small>last hour</small></div>
          </div>
          <div className="mk-uri">
            <div className="mk-uri-label"><span>CONNECTION STRING</span><span>TLS REQUIRED</span></div>
            <code>postgresql://payments_owner:••••••@db.stashi.dev:6432/payments?sslmode=require</code>
          </div>
        </div>
      </section>

      <section className="mk-strip">
        <div className="mk-wrap mk-strip-inner">
          <div className="mk-strip-copy">
            <span className="mk-kicker">The service</span>
            <h2>Postgres you can provision without learning a cloud billing model.</h2>
            <p>Stashi handles the database endpoint, credentials, connection pooling and service health. You keep the normal PostgreSQL workflow and a monthly price that stays tied to the plan you chose.</p>
          </div>
          <div className="mk-spec-list">
            <div className="mk-spec"><span>Connection</span><strong>Standard PostgreSQL URL over TLS</strong></div>
            <div className="mk-spec"><span>Pooling</span><strong>PgBouncer included</strong></div>
            <div className="mk-spec"><span>Visibility</span><strong>Storage, connections and query activity</strong></div>
            <div className="mk-spec"><span>Plans</span><strong>Fixed monthly price with published limits</strong></div>
          </div>
        </div>
      </section>

      <section className="mk-wrap mk-story">
        <div className="mk-story-grid">
          <div>
            <span className="mk-kicker">Built for real apps</span>
            <h2>The common PostgreSQL path stays familiar.</h2>
          </div>
          <div className="mk-story-body">
            <div className="mk-story-row">
              <span>CREATE</span>
              <div><h3>Choose a plan and name the database.</h3><p>The dashboard returns credentials and the connection string after provisioning. No instance sizing screen sits in front of the first query.</p></div>
            </div>
            <div className="mk-story-row">
              <span>RUN</span>
              <div><h3>Use your existing PostgreSQL stack.</h3><p>Connect from Prisma, Drizzle, Django, Rails, psql or another standard client. TLS is required at the public endpoint.</p></div>
            </div>
            <div className="mk-story-row">
              <span>WATCH</span>
              <div><h3>See when the database is getting tight.</h3><p>Storage, active connections and query activity stay visible. Upgrade decisions come from the workload rather than an opaque compute meter.</p></div>
            </div>
            <div className="mk-story-row">
              <span>MOVE</span>
              <div><h3>It is still PostgreSQL.</h3><p>Use pg_dump and normal PostgreSQL tooling when you need to migrate. Stashi does not depend on a proprietary database API.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mk-price-tease">
        <div className="mk-wrap mk-price-tease-inner">
          <div><span className="mk-price-note">PLANS START AT $1 / MONTH</span><h2>Pick a limit. Know the bill.</h2></div>
          <div><p>Dev plans cover tiny projects. Starter and Production add more storage, connections and backup retention. Dedicated capacity is available for workloads that need it.</p><Link className="mk-button mk-button-light" href="/pricing">Compare plans <ArrowRight size={15} /></Link></div>
        </div>
      </section>

      <section className="mk-wrap mk-final">
        <div className="mk-final-panel mk-noise">
          <div><span className="mk-kicker">PostgreSQL, ready to connect</span><h2>Create your first database.</h2></div>
          <Link className="mk-button mk-button-dark" href="/login">Get started <ArrowRight size={16} /></Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
