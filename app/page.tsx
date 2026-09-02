import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import styles from "./marketing.module.css";

const heroPhoto = "https://images.unsplash.com/photo-1545665277-5937489579f2?auto=format&fit=crop&w=1800&q=82";
const infraPhoto = "https://images.unsplash.com/photo-1695668548342-c0c1ad479aee?auto=format&fit=crop&w=1900&q=82";

export default function Home() {
  return (
    <main className={`${styles.page} mk-shell`}>
      <SiteHeader />

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Managed PostgreSQL</span>
          <h1>Production Postgres from $1 a month.</h1>
          <p>Create a database, copy the TLS connection string, and connect with the PostgreSQL tools you already use. The monthly price comes from the plan you choose.</p>
          <div className={styles.actions}>
            <Link className="mk-button mk-button-dark" href="/login">Create database <ArrowRight size={16} /></Link>
            <Link className="mk-button mk-button-quiet" href="/pricing">View pricing</Link>
          </div>
        </div>

        <div className={styles.heroVisual} aria-label="Stashi dashboard shown over a developer workstation">
          <div className={styles.heroPhoto}>
            <img src={heroPhoto} alt="Developer workstation with code open across multiple displays" />
            <a className={styles.photoCredit} href="https://unsplash.com/photos/turned-on-laptop-computer-BMnhuwFYr7w" target="_blank" rel="noreferrer">Joshua Aragon / Unsplash</a>
          </div>

          <div className={styles.dashboard}>
            <div className={styles.dashboardTop}><span>STASHI / DATABASE</span><b>HEALTHY</b></div>
            <div className={styles.dashboardHead}>
              <div><span>DATABASE</span><strong>payments-api</strong></div>
              <div className={styles.status}>ONLINE</div>
            </div>
            <div className={styles.metrics}>
              <div className={styles.metric}><span>STORAGE</span><strong>842 MB</strong><small>5 GB limit</small></div>
              <div className={styles.metric}><span>CONNECTIONS</span><strong>7</strong><small>30 limit</small></div>
              <div className={styles.metric}><span>P95 LATENCY</span><strong>38 ms</strong><small>last hour</small></div>
            </div>
            <div className={styles.connection}>
              <div className={styles.connectionLabel}><span>CONNECTION STRING</span><span>TLS REQUIRED</span></div>
              <code>postgresql://payments_owner:••••••@db.stashi.dev:6432/payments?sslmode=require</code>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.proofBand} aria-label="Platform details">
        <div className={styles.proofGrid}>
          <div className={styles.proofItem}><span>ENTRY PLAN</span><strong>$1 / month</strong></div>
          <div className={styles.proofItem}><span>ENGINE</span><strong>PostgreSQL 17</strong></div>
          <div className={styles.proofItem}><span>PUBLIC CONNECTION</span><strong>TLS + PgBouncer</strong></div>
          <div className={styles.proofItem}><span>BILLING</span><strong>Fixed plans</strong></div>
        </div>
      </section>

      <section className={styles.story}>
        <div className={styles.storyIntro}>
          <div>
            <span className={styles.kicker}>From empty project to connected app</span>
            <h2>The useful parts stay in view.</h2>
          </div>
          <p>The dashboard is built around the work a developer actually has to do: provision the database, get credentials, watch pressure, restore when something goes wrong.</p>
        </div>

        <div className={styles.productRows}>
          <article className={styles.productRow}>
            <div className={styles.productFrame} aria-label="Create database screen preview">
              <div className={styles.mockWindow}>
                <div className={styles.windowBar}><span>NEW DATABASE</span><span>01 / 02</span></div>
                <div className={styles.windowBody}>
                  <label className={styles.formLabel}>DATABASE NAME</label>
                  <div className={styles.fakeInput}>inventory-api</div>
                  <label className={styles.formLabel}>PLAN</label>
                  <div className={styles.planChoices}>
                    <div className={styles.planChoice}><span>DEV</span><strong>$1</strong><span>1 GB</span></div>
                    <div className={`${styles.planChoice} ${styles.planChoiceSelected}`}><span>STARTER</span><strong>$3</strong><span>5 GB</span></div>
                    <div className={styles.planChoice}><span>PRODUCTION</span><strong>$5</strong><span>15 GB</span></div>
                  </div>
                  <div className={styles.provisionAction}><span className={styles.fakeButton}>CREATE DATABASE</span></div>
                </div>
              </div>
            </div>
            <div className={styles.productCopy}>
              <span className={styles.kicker}>Provision</span>
              <h3>Name it. Choose a plan. Create it.</h3>
              <p>The first screen asks for the few decisions that change the service. Database credentials and the endpoint are generated after provisioning.</p>
              <ul>
                <li><span>Engine</span><strong>PostgreSQL 17</strong></li>
                <li><span>Plan price</span><strong>shown before create</strong></li>
                <li><span>Connection</span><strong>TLS required</strong></li>
              </ul>
            </div>
          </article>

          <article className={`${styles.productRow} ${styles.productRowReverse}`}>
            <div className={styles.productFrame} aria-label="Connection credentials screen preview">
              <div className={styles.credentialWindow}>
                <div className={styles.credentialTop}><span>CONNECTION</span><span>READY</span></div>
                <div className={styles.credentialValue}>
                  <span>DATABASE URL</span>
                  <code>postgresql://inventory_owner:••••••••@db.stashi.dev:6432/inventory?sslmode=require</code>
                </div>
                <div className={styles.credentialActions}>
                  <span className={styles.credentialChip}>COPY URL</span>
                  <span className={styles.credentialChip}>REVEAL PASSWORD</span>
                  <span className={styles.credentialChip}>ROTATE</span>
                </div>
              </div>
            </div>
            <div className={styles.productCopy}>
              <span className={styles.kicker}>Connect</span>
              <h3>The connection string is ready for your app.</h3>
              <p>Copy the URL into Prisma, Django, Rails, psql or another PostgreSQL client. Credentials can be rotated from the same database view.</p>
              <ul>
                <li><span>Pooling</span><strong>PgBouncer</strong></li>
                <li><span>Credentials</span><strong>copy, reveal, rotate</strong></li>
                <li><span>Migration</span><strong>pg_dump / pg_restore</strong></li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      <section className={styles.infra}>
        <div className={styles.infraInner}>
          <div className={styles.infraPhoto}>
            <img src={infraPhoto} alt="Close view of a populated server rack with network cabling" loading="lazy" />
            <a className={styles.photoCredit} href="https://unsplash.com/photos/a-rack-of-servers-in-a-server-room-2JJ3wBHu4_0" target="_blank" rel="noreferrer">Kevin Ache / Unsplash</a>
            <div className={styles.nodeOverlay}>
              <div className={styles.nodeOverlayTop}><span>NODE / NJ-01</span><span>ACCEPTING DATABASES</span></div>
              <div className={styles.nodeBars}>
                <div className={styles.nodeBar}><span>CPU 34%</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: "34%" }} /></div></div>
                <div className={styles.nodeBar}><span>MEMORY 61%</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: "61%" }} /></div></div>
                <div className={styles.nodeBar}><span>DISK 22%</span><div className={styles.barTrack}><div className={styles.barFill} style={{ width: "22%" }} /></div></div>
              </div>
            </div>
          </div>

          <div className={styles.infraCopy}>
            <span className={styles.kicker}>Infrastructure you can inspect</span>
            <h2>Capacity is visible before it becomes your problem.</h2>
            <p>Stashi tracks node pressure and database limits in the operator layer. Customer plans stay simple while the service watches CPU, memory, disk and connection pressure underneath.</p>
            <div className={styles.infraFacts}>
              <div className={styles.infraFact}><span>Database endpoint</span><strong>TLS required</strong></div>
              <div className={styles.infraFact}><span>Raw PostgreSQL port</span><strong>private</strong></div>
              <div className={styles.infraFact}><span>Backups</span><strong>plan retention</strong></div>
              <div className={styles.infraFact}><span>Scaling</span><strong>capacity based</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.priceSection}>
        <div className={styles.priceLead}>
          <span className={styles.kicker}>Pricing</span>
          <h2>Small plans for small workloads.</h2>
          <p>Start with the workload you have. Storage, connection limits and backup retention are published with each plan.</p>
          <Link className="mk-button mk-button-dark" href="/pricing">Compare plans <ArrowRight size={15} /></Link>
        </div>
        <div className={styles.priceTiles}>
          <div className={styles.priceTile}><span>DEV</span><strong>$1</strong><p>Experiments, coursework and tiny services.</p></div>
          <div className={styles.priceTile}><span>STARTER</span><strong>$3</strong><p>Small apps with real users.</p></div>
          <div className={styles.priceTile}><span>PRODUCTION</span><strong>$5</strong><p>Active applications with higher limits.</p></div>
          <div className={styles.priceTile}><span>DEDICATED</span><strong>$9+</strong><p>Reserved capacity for heavier workloads.</p></div>
        </div>
      </section>

      <section className={styles.final}>
        <img src={infraPhoto} alt="Server rack in a dark data center" loading="lazy" />
        <div className={styles.finalInner}>
          <div className={styles.finalCopy}>
            <span className={styles.kicker}>Ready when your app is</span>
            <h2>Create a PostgreSQL database and connect.</h2>
          </div>
          <Link className="mk-button mk-button-light" href="/login">Create database <ArrowRight size={16} /></Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
