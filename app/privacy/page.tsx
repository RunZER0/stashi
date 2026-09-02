import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Stashi handles account, service and Google sign-in data.",
};

export default function PrivacyPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <section className="mk-wrap mk-legal">
        <div className="mk-legal-grid">
          <aside className="mk-legal-aside">
            Stashi Privacy Policy<br />
            Effective 2 September 2026<br /><br />
            This page applies to the Stashi website, dashboard and managed PostgreSQL service.
          </aside>
          <article className="mk-legal-body">
            <h1>Privacy Policy</h1>
            <p>Effective 2 September 2026</p>

            <h2>Information we collect</h2>
            <p>Stashi collects the information needed to create and operate an account, including your email address, account identifiers, service settings and billing-related records. The service also records operational data such as database status, storage usage, connection counts, query-performance statistics, backup activity, IP addresses and security events.</p>

            <h2>Google sign-in data</h2>
            <p>If you choose to sign in with Google, Stashi uses Google OAuth for authentication. For sign-in, Stashi requests basic identity information that you authorize, such as your email address, name and profile image. That information is used to identify your account and display your profile.</p>
            <p>Stashi does not use Google sign-in data for advertising and does not sell it. Basic Google account data used for authentication is not shared with unrelated third parties. If Stashi later requests access to additional Google user data, the consent screen and this policy will be updated before that access is used.</p>

            <h2>How information is used</h2>
            <p>Account and service data is used to provide the dashboard, provision databases, authenticate requests, prevent abuse, support customers, operate billing and improve service reliability. Operational metrics may be aggregated to understand capacity and product performance.</p>

            <h2>Database content</h2>
            <p>Your application data remains your data. Stashi processes database content to host the database, complete backup or restore operations, respond to support requests you initiate, and protect the service. Access by operators should be limited to cases where it is required for service operation, security or support.</p>

            <h2>Service providers</h2>
            <p>Stashi may use infrastructure, payment, email, monitoring and authentication providers to operate the service. They receive only the information required for the work they perform and are subject to their own contractual and legal obligations.</p>

            <h2>Retention</h2>
            <p>Account records are retained while your account is active and for a reasonable period afterward when needed for billing, fraud prevention, security, dispute handling or legal obligations. Database backups follow the retention period attached to your plan. Deleted data may remain in backups until the relevant retention window expires.</p>

            <h2>Security</h2>
            <p>Stashi uses transport encryption for public database connections and applies access controls around service credentials and administrative systems. No internet service can guarantee absolute security. Customers are responsible for protecting their credentials and for choosing what data they store in the service.</p>

            <h2>Your choices</h2>
            <p>You may request access to, correction of or deletion of personal information associated with your account, subject to records Stashi must retain for legal or operational reasons. You can also disconnect Google sign-in from your Google Account settings.</p>

            <h2>Changes</h2>
            <p>This policy may change as the service changes. Material updates will be reflected on this page with a new effective date.</p>

            <h2>Contact</h2>
            <p>Privacy questions can be sent to <a href="mailto:legal@ynai.co.ke">legal@ynai.co.ke</a>.</p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
