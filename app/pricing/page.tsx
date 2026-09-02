import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { plans } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Fixed monthly PostgreSQL plans starting at $1.",
};

export default function PricingPage() {
  return (
    <main className="mk-shell">
      <SiteHeader />
      <header className="mk-wrap mk-pagehead">
        <span className="mk-kicker">Pricing</span>
        <h1>Fixed monthly plans.</h1>
        <p>Choose the capacity you need now. Capacity limits and backup retention are published with the price.</p>
      </header>

      <section className="mk-wrap mk-pricing">
        <div className="mk-pricing-grid">
          {plans.map((plan) => (
            <article className={`mk-plan ${plan.recommended ? "is-featured" : ""}`} key={plan.id}>
              <div className="mk-plan-name">
                <span>{plan.name}</span>
                {plan.recommended ? <span className="mk-plan-badge">START HERE</span> : null}
              </div>
              <div className="mk-plan-price">
                <strong>{plan.price === null ? "$9+" : `$${plan.price}`}</strong>
                <span>/ month</span>
              </div>
              <p>{plan.tagline}</p>
              <div className="mk-plan-specs">
                <div className="mk-plan-spec"><span>Storage</span><strong>{plan.storageGb} GB</strong></div>
                <div className="mk-plan-spec"><span>Connections</span><strong>{plan.connections}</strong></div>
                <div className="mk-plan-spec"><span>Backup retention</span><strong>{plan.backupRetentionDays} day{plan.backupRetentionDays === 1 ? "" : "s"}</strong></div>
                <div className="mk-plan-spec"><span>Placement</span><strong>{plan.isolation}</strong></div>
              </div>
              <Link className="mk-button mk-button-dark" href="/login">Choose {plan.name} <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>

        <div className="mk-price-foot">
          <div>
            <h2>No usage-metered compute line item.</h2>
            <p>The monthly database price comes from the plan. If a workload reaches its published limits, the dashboard should make that pressure visible before an upgrade is required.</p>
          </div>
          <div>
            <h2>Dedicated capacity starts higher.</h2>
            <p>Dedicated plans reserve a PostgreSQL node for workloads that need stronger isolation or more predictable resources. Exact capacity is shown before purchase.</p>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
