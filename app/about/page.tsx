import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "About Stashi",
  description: "What Stashi is, who runs it, and how sign-in and database access work.",
};

export default function AboutPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <section className="mk-wrap mk-legal">
        <div className="mk-legal-grid">
          <aside className="mk-legal-aside">
            About Stashi<br />
            <br />
            The identity and data-handling summary for this application, referenced from the
            Google and GitHub sign-in screens.
          </aside>
          <article className="mk-legal-body">
            <h1>About Stashi</h1>

            <h2>What Stashi is</h2>
            <p>
              Stashi is a managed PostgreSQL 17 hosting service built for developers and AI agents. Every
              database is provisioned automatically, reachable over TLS through PgBouncer connection
              pooling, and billed on a fixed monthly plan with no separate compute metering. The service
              includes a browser console (SQL editor, connection details, backups), a Model Context
              Protocol (MCP) server so AI coding agents can inspect schema and run scoped queries directly,
              and both logical checkpoints and continuous point-in-time recovery for backups.
            </p>

            <h2>Who operates it</h2>
            <p>
              Stashi is operated as a single production service running on infrastructure Stashi controls
              directly (not resold from a database-as-a-service reseller). Support and account questions go
              to the contact address below, not a ticket queue behind a separate company.
            </p>

            <h2>Signing in with Google or GitHub</h2>
            <p>
              Stashi uses Google and GitHub only for authentication (OAuth sign-in), via Auth.js. Signing in
              requests your basic profile information &mdash; name, email address, and profile image &mdash;
              which is used solely to identify your Stashi account and is not used for advertising. Stashi
              does not request access to your Google Drive, Gmail, GitHub repositories, or any other data
              beyond basic sign-in identity. Full detail on what is collected and how it is used is in the{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>

            <h2>What "Stashi" stores</h2>
            <p>
              The one thing Stashi's name refers to plainly: the PostgreSQL databases you create and store
              data in. Your database content is yours &mdash; Stashi's operators access it only to run the
              service itself (provisioning, backups, restores) or to help with a support request you open.
            </p>

            <h2>Legal</h2>
            <p>
              <Link href="/terms">Terms of Service</Link> &middot; <Link href="/privacy">Privacy Policy</Link>
            </p>

            <h2>Contact</h2>
            <p>
              Questions about this application, its use of Google/GitHub sign-in, or anything else can be
              sent to <a href="mailto:legal@ynai.co.ke">legal@ynai.co.ke</a>.
            </p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
