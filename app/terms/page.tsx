import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing use of the Stashi managed PostgreSQL service.",
};

export default function TermsPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <section className="mk-wrap mk-legal">
        <div className="mk-legal-grid">
          <aside className="mk-legal-aside">
            Stashi Terms of Service<br />
            Effective 2 September 2026<br /><br />
            These terms govern use of the Stashi website, dashboard and database service.
          </aside>
          <article className="mk-legal-body">
            <h1>Terms of Service</h1>
            <p>Effective 2 September 2026</p>

            <h2>Service</h2>
            <p>Stashi provides managed PostgreSQL hosting and related account, monitoring, backup and database-management features. Available features, limits and prices are described on the product and pricing pages or in the dashboard.</p>

            <h2>Accounts</h2>
            <p>You are responsible for information submitted through your account and for keeping account and database credentials secure. Activity performed with valid credentials may be treated as activity authorized by the account holder.</p>

            <h2>Acceptable use</h2>
            <p>You may not use Stashi to violate applicable law, interfere with other users, probe or attack systems without authorization, distribute malware, operate abusive automated traffic, or store content that you do not have the right to process. Stashi may restrict or suspend activity that creates a material security or reliability risk.</p>

            <h2>Plans and payment</h2>
            <p>Paid plans are billed at the price shown when the plan is selected. Taxes or payment-provider charges may apply where required. Changes to future pricing will be presented before they apply to a new billing period.</p>

            <h2>Limits</h2>
            <p>Each plan includes defined limits such as storage, connections, backup retention or reserved capacity. Stashi may reject new connections, pause writes, restrict provisioning or require a plan change when a database exceeds a hard service limit.</p>

            <h2>Availability and maintenance</h2>
            <p>Stashi aims to keep the service available, but uninterrupted operation is not guaranteed. Maintenance, infrastructure failures, network faults and security incidents can cause temporary disruption. Service status and material incidents may be communicated through the dashboard or account contact channels.</p>

            <h2>Backups and recovery</h2>
            <p>Backup retention depends on the selected plan. A backup feature reduces recovery risk but does not replace your own disaster-recovery process. Customers running important workloads should maintain an independent copy of data needed for business continuity.</p>

            <h2>Your data</h2>
            <p>You retain rights in the application data stored in your databases. You grant Stashi the limited rights required to host, copy, back up, restore, transmit and otherwise process that data to provide and secure the service.</p>

            <h2>Suspension and termination</h2>
            <p>You may stop using the service at any time. Stashi may suspend or terminate an account for non-payment, serious abuse, security risk or a material breach of these terms. Data may be deleted after termination in line with the applicable retention process.</p>

            <h2>Liability</h2>
            <p>To the extent permitted by applicable law, Stashi is provided without warranties beyond those expressly stated in a written agreement. Stashi is not liable for indirect, incidental or consequential losses arising from use of the service. Any mandatory rights that cannot legally be excluded remain unaffected.</p>

            <h2>Changes</h2>
            <p>These terms may be updated as the service changes. Material changes will be posted on this page with a revised effective date. Continued use after an update means the new terms apply from their stated effective date.</p>

            <h2>Contact</h2>
            <p>Questions about these terms can be sent to <a href="mailto:legal@ynai.co.ke">legal@ynai.co.ke</a>.</p>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
