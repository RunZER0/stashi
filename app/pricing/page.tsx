import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { plans } from "@/lib/plans";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Low-cost, fixed monthly managed PostgreSQL plans starting at $2 for applications, teams, and automated workflows.",
};

const pricingPhoto = "https://images.unsplash.com/photo-1545665277-5937489579f2?auto=format&fit=crop&w=1800&q=82";

export default function PricingPage() {
  return (
    <main className={`${styles.page} mk-shell`}>
      <SiteHeader />

      <header className={styles.pricingHero}>
        <div>
          <span className={styles.kicker}>
            Fixed Monthly Pricing
          </span>
          <h1>Predictable plans. Clear headroom.</h1>
          <p>
            Choose the capacity you need now. Storage, connection limits, and backup retention are shown upfront with the price, so you can grow an application without guessing what the next bill will be.
          </p>
        </div>
        <div className={styles.pricingPhoto}>
          <img src={pricingPhoto} alt="Developer workstation with code open on multiple displays" />
          <a className={styles.photoCredit} href="https://unsplash.com/photos/turned-on-laptop-computer-BMnhuwFYr7w" target="_blank" rel="noreferrer">Joshua Aragon / Unsplash</a>
        </div>
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
                <div className="mk-plan-spec"><span>API &amp; MCP access</span><strong>Full access</strong></div>
                <div className="mk-plan-spec"><span>Billing Guardrail</span><strong>100% Hard Cap</strong></div>
              </div>
              <Link className="mk-button mk-button-dark" href="/login">Choose {plan.name} <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>

        <div className="mk-price-foot">
          <div>
            <h2>The price is the plan.</h2>
            <p>There is no separate compute-unit charge or hidden usage meter. If a workload grows or a database reaches its plan limits, the dashboard shows the pressure rather than inflating your invoice.</p>
          </div>
          <div>
            <h2>Dedicated capacity for demanding workloads.</h2>
            <p>Dedicated plans reserve an isolated PostgreSQL node for production applications, data-intensive services, and high-throughput automations that need dedicated memory and predictable IOPS. Exact capacity is shown before purchase.</p>
          </div>
        </div>
      </section>

      <section className={styles.planIntent} aria-label="Plan use cases">
        <div className={styles.intentItem}><span>DEV / $2</span><strong>Experiments &amp; prototypes</strong><p>Personal projects, test databases, and rapid product exploration.</p></div>
        <div className={styles.intentItem}><span>STARTER / $3</span><strong>Growing applications</strong><p>Small production apps, internal tools, and connected workflows.</p></div>
        <div className={styles.intentItem}><span>PRODUCTION / $5</span><strong>Active products &amp; teams</strong><p>Production applications, integrations, and longer backup retention.</p></div>
        <div className={styles.intentItem}><span>DEDICATED / $9+</span><strong>Demanding workloads</strong><p>High-throughput services and private infrastructure needing isolated capacity.</p></div>
      </section>

      <SiteFooter />
    </main>
  );
}
