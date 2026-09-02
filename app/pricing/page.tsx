import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { plans } from "@/lib/plans";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Low-cost, fixed monthly PostgreSQL plans starting at $1. Safe for autonomous AI agent loops with 0% runaway bill risk.",
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
          <h1>Predictable plans. Zero loop surprises.</h1>
          <p>
            Choose the capacity you need now. Storage, connection limits, and backup retention are shown upfront with the price. Hard billing caps prevent autonomous agent loops from running up runaway charges.
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
                <div className="mk-plan-spec"><span>MCP &amp; Agent Tooling</span><strong>Full access</strong></div>
                <div className="mk-plan-spec"><span>Billing Guardrail</span><strong>100% Hard Cap</strong></div>
              </div>
              <Link className="mk-button mk-button-dark" href="/login">Choose {plan.name} <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>

        <div className="mk-price-foot">
          <div>
            <h2>The price is the plan.</h2>
            <p>There is no separate compute-unit charge or silent token metering. If an agent loops overnight or a database reaches its plan limits, the dashboard shows the pressure rather than inflating your invoice.</p>
          </div>
          <div>
            <h2>Dedicated capacity for heavy reasoning.</h2>
            <p>Dedicated plans reserve an isolated PostgreSQL node for agent swarms or production workloads that need dedicated memory and predictable IOPS. Exact capacity is shown before purchase.</p>
          </div>
        </div>
      </section>

      <section className={styles.planIntent} aria-label="Plan use cases">
        <div className={styles.intentItem}><span>DEV / $1</span><strong>Agent Sandboxes &amp; Evals</strong><p>Ephemeral test databases, subagent scratchpads, and rapid prototyping.</p></div>
        <div className={styles.intentItem}><span>STARTER / $3</span><strong>Agent Memory &amp; Production</strong><p>Multi-agent state stores, personal apps, and internal team tooling.</p></div>
        <div className={styles.intentItem}><span>PRODUCTION / $5</span><strong>High-Concurrency Swarms</strong><p>Active production apps, parallel tool calls, and longer backup retention.</p></div>
        <div className={styles.intentItem}><span>DEDICATED / $9+</span><strong>Continuous Reasoning</strong><p>Heavy workloads and private swarms needing isolated compute nodes.</p></div>
      </section>

      <SiteFooter />
    </main>
  );
}
