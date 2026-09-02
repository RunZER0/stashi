import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { plans } from "@/lib/plans";
import styles from "../marketing.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Fixed monthly PostgreSQL plans starting at $1.",
};

const pricingPhoto = "https://images.unsplash.com/photo-1545665277-5937489579f2?auto=format&fit=crop&w=1800&q=82";

export default function PricingPage() {
  return (
    <main className={`${styles.page} mk-shell`}>
      <SiteHeader />

      <header className={styles.pricingHero}>
        <div>
          <span className={styles.kicker}>Pricing</span>
          <h1>Fixed monthly plans.</h1>
          <p>Choose the capacity you need now. Storage, connection limits and backup retention are shown with the price.</p>
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
                <div className="mk-plan-spec"><span>Placement</span><strong>{plan.isolation}</strong></div>
              </div>
              <Link className="mk-button mk-button-dark" href="/login">Choose {plan.name} <ArrowRight size={14} /></Link>
            </article>
          ))}
        </div>

        <div className="mk-price-foot">
          <div>
            <h2>The price is the plan.</h2>
            <p>There is no separate compute-unit charge. If a database reaches its plan limits, the dashboard shows the pressure before you move it up.</p>
          </div>
          <div>
            <h2>Dedicated capacity starts higher.</h2>
            <p>Dedicated plans reserve a PostgreSQL node for workloads that need stronger isolation or more predictable resources. Exact capacity is shown before purchase.</p>
          </div>
        </div>
      </section>

      <section className={styles.planIntent} aria-label="Plan use cases">
        <div className={styles.intentItem}><span>DEV / $1</span><strong>Try an idea.</strong><p>Small prototypes, coursework and development databases.</p></div>
        <div className={styles.intentItem}><span>STARTER / $3</span><strong>Put an app online.</strong><p>Early products and internal tools with modest traffic.</p></div>
        <div className={styles.intentItem}><span>PRODUCTION / $5</span><strong>Run an active service.</strong><p>More storage, more connections and longer backup retention.</p></div>
        <div className={styles.intentItem}><span>DEDICATED / $9+</span><strong>Reserve capacity.</strong><p>Heavier workloads that need their own PostgreSQL node.</p></div>
      </section>

      <SiteFooter />
    </main>
  );
}
