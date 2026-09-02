import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Product",
  description: "Managed PostgreSQL with TLS endpoints, pooling, metrics and fixed monthly plans.",
};

export default function ProductPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <header className="mk-wrap mk-pagehead">
        <span className="mk-kicker">Product</span>
        <h1>Managed PostgreSQL with the normal PostgreSQL workflow.</h1>
        <p>Provision a database, connect with a standard client, and manage the service from one dashboard. Plan limits stay visible beside the operational signals that matter to a small production workload.</p>
      </header>

      <section className="mk-wrap mk-product">
        <article className="mk-product-row">
          <div><span className="mk-kicker">Provisioning</span><h2>A connection string is the deliverable.</h2></div>
          <div className="mk-product-copy">
            <p>Create a database by choosing its name and plan. Stashi assigns credentials and returns a TLS PostgreSQL URL for the application.</p>
            <div className="mk-product-points">
              <div className="mk-product-point"><span>Engine</span><strong>PostgreSQL 17</strong></div>
              <div className="mk-product-point"><span>Public endpoint</span><strong>TLS required</strong></div>
              <div className="mk-product-point"><span>Pooling</span><strong>PgBouncer</strong></div>
            </div>
          </div>
        </article>

        <article className="mk-product-row">
          <div><span className="mk-kicker">Operations</span><h2>Health and limits stay on the same screen.</h2></div>
          <div className="mk-product-copy">
            <p>The database view shows storage use, active connections, latency and recent query activity. Credential changes happen from the same surface.</p>
            <div className="mk-product-points">
              <div className="mk-product-point"><span>Metrics</span><strong>Capacity and latency</strong></div>
              <div className="mk-product-point"><span>Query activity</span><strong>Powered by PostgreSQL statistics</strong></div>
              <div className="mk-product-point"><span>Credentials</span><strong>Copy or rotate from the dashboard</strong></div>
              <div className="mk-product-point"><span>Lifecycle</span><strong>Suspend or resume access; delete when finished</strong></div>
            </div>
          </div>
        </article>

        <article className="mk-product-row">
          <div><span className="mk-kicker">Recovery</span><h2>Backups are part of the database plan.</h2></div>
          <div className="mk-product-copy">
            <p>Backup retention increases with the plan. Restore requests stay visible in the dashboard with their current status.</p>
            <p>For critical systems, keep an independent backup outside Stashi as part of your own recovery plan.</p>
          </div>
        </article>

        <article className="mk-product-row">
          <div><span className="mk-kicker">Portability</span><h2>Standard tools remain useful.</h2></div>
          <div className="mk-product-copy">
            <p>Applications connect over the PostgreSQL protocol. Migration uses familiar PostgreSQL tooling such as pg_dump and pg_restore, which keeps the exit path understandable.</p>
            <Link className="mk-button mk-button-dark" href="/pricing">See plans <ArrowRight size={15} /></Link>
          </div>
        </article>
      </section>
      <SiteFooter />
    </main>
  );
}
