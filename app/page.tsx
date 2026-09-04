import Link from "next/link";
import { ArrowRight, Copy } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AmbientVideoBackground } from "@/components/ambient-video-background";
import { HeroVisual } from "./hero-visual";
import { AgentTabs } from "./agent-tabs";
import { LiveAgentPlayground } from "@/components/live-agent-playground";
import styles from "./marketing.module.css";

const infraPhoto = "https://images.unsplash.com/photo-1695668548342-c0c1ad479aee?auto=format&fit=crop&w=1900&q=82";

export default function Home() {
  return (
    <main className={`${styles.page} mk-shell`} style={{ position: "relative" }}>
      {/* Cinematic Ambient Background Video */}
      <AmbientVideoBackground />

      {/* Header */}
      <SiteHeader />

      {/* Hero Section */}
      <section className={styles.hero} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker} style={{ color: "#34d399", letterSpacing: ".12em" }}>
            Low-Cost · Agentic Tuned
          </span>
          <h1 style={{ color: "#f5f6f4" }}>
            Low-cost, agentic-tuned PostgreSQL from $1 a month.
          </h1>
          <p style={{ color: "#a4aca3" }}>
            Automatic provisioning via MCP &amp; REST, no ticket queue. Hard-capped fixed pricing from $1/mo protects you from runaway autonomous loop bills. PostgreSQL 17 with TLS and PgBouncer pooling.
          </p>
          <div className={styles.actions}>
            <Link className="mk-button mk-button-dark" href="/login">
              Create database <ArrowRight size={16} />
            </Link>
            <Link className="mk-button mk-button-quiet" href="#agentic">
              Agent &amp; MCP Workflows
            </Link>
          </div>
          <div
            style={{
              marginTop: "24px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "11px",
              color: "#859085",
              fontFamily: '"SFMono-Regular", Consolas, monospace',
            }}
          >
            <span>Quick MCP setup:</span>
            <code
              style={{
                background: "rgba(17, 20, 17, 0.9)",
                color: "#34d399",
                padding: "5px 9px",
                border: "1px solid #232b23",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
              }}
            >
              npx -y @stashidb/mcp-server
            </code>
          </div>
        </div>

        <HeroVisual />
      </section>

      {/* Real-time Telemetry Signal Ribbon */}
      <section className={styles.proofBand} aria-label="Platform details" style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.proofGrid}>
          <div className={styles.proofItem}>
            <span>ENTRY FLOOR</span>
            <strong style={{ color: "#34d399" }}>$1 / month (Flat)</strong>
          </div>
          <div className={styles.proofItem}>
            <span>AGENTIC PROTOCOL</span>
            <strong>Native MCP Server</strong>
          </div>
          <div className={styles.proofItem}>
            <span>FINANCIAL GUARDRAILS</span>
            <strong>Zero Compute Overages</strong>
          </div>
          <div className={styles.proofItem}>
            <span>ENGINE &amp; POOL</span>
            <strong>PostgreSQL 17 + TLS</strong>
          </div>
        </div>
      </section>

      {/* ASYMMETRICAL BENTO GRID: AGENTIC INFRASTRUCTURE */}
      <section id="agentic" className="mk-wrap" style={{ padding: "112px 0 60px", position: "relative", zIndex: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: "60px", alignItems: "flex-end", marginBottom: "52px" }}>
          <div>
            <span className={styles.kicker} style={{ color: "#34d399" }}>
              Agentic Infrastructure
            </span>
            <h2 style={{ fontSize: "clamp(38px, 4.4vw, 58px)", lineHeight: "1.0", letterSpacing: "-.065em", margin: "14px 0 0", color: "#f5f6f4" }}>
              Built for autonomous loops, subagent swarms, and MCP tools.
            </h2>
          </div>
          <p style={{ color: "#8f988e", fontSize: "15px", lineHeight: "1.75", margin: 0 }}>
            When AI agents write schema, execute autonomous migrations, or store multi-agent memory, serverless compute meters can bankrupt you overnight. Stashi combines fast, automatic provisioning with hard-capped flat pricing and one-command checkpoint rollbacks.
          </p>
        </div>

        {/* Dynamic Bento Layout */}
        <div className="mk-bento-grid">
          {/* Card 1: Wide 7-col Bento Box */}
          <div className="mk-bento-card mk-bento-7" style={{ minHeight: "260px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ font: '700 9px/1 "SFMono-Regular", Consolas, monospace', color: "#34d399", letterSpacing: ".1em" }}>
                  01 / MODEL CONTEXT PROTOCOL
                </span>
                <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#798378", border: "1px solid #232a23", padding: "3px 6px" }}>
                  TOOL CALLING READY
                </span>
              </div>
              <h3 style={{ fontSize: "24px", letterSpacing: "-.04em", margin: "0 0 12px", color: "#f5f6f4", fontWeight: 700 }}>
                Native MCP Server for Claude, Cursor &amp; Antigravity
              </h3>
              <p style={{ fontSize: "14px", lineHeight: "1.7", color: "#8f988e", margin: 0, maxWidth: "580px" }}>
                Connect agents directly through standard Model Context Protocol. AI assistants inspect your schema, run scoped queries, and create or roll back checkpoints — through the same audited path a human's queries take, nothing hidden from your activity log.
              </p>
            </div>
            <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap", position: "relative", zIndex: 2 }}>
              <span style={{ font: '700 9px/1 "SFMono-Regular", monospace', color: "#a4b5a6", background: "#141914", border: "1px solid #242f24", padding: "5px 9px" }}>
                Claude Code
              </span>
              <span style={{ font: '700 9px/1 "SFMono-Regular", monospace', color: "#a4b5a6", background: "#141914", border: "1px solid #242f24", padding: "5px 9px" }}>
                Cursor / Windsurf
              </span>
              <span style={{ font: '700 9px/1 "SFMono-Regular", monospace', color: "#a4b5a6", background: "#141914", border: "1px solid #242f24", padding: "5px 9px" }}>
                LangGraph &amp; LlamaIndex
              </span>
            </div>
          </div>

          {/* Card 2: 5-col Bento Box */}
          <div className="mk-bento-card mk-bento-5" style={{ minHeight: "260px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ font: '700 9px/1 "SFMono-Regular", Consolas, monospace', color: "#34d399", letterSpacing: ".1em" }}>
                  02 / FINANCIAL GUARDRAIL
                </span>
                <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#34d399" }}>
                  100% HARD CAP
                </span>
              </div>
              <h3 style={{ fontSize: "22px", letterSpacing: "-.04em", margin: "0 0 12px", color: "#f5f6f4", fontWeight: 700 }}>
                Loop-Safe Flat Billing
              </h3>
              <p style={{ fontSize: "13px", lineHeight: "1.7", color: "#8f988e", margin: 0 }}>
                Autonomous reasoning loops running 24/7 will never spike your card. Hard billing caps at $1, $3, or $5/mo guarantee 0% runaway cloud bills.
              </p>
            </div>
            <div style={{ marginTop: "20px", padding: "10px 12px", background: "#060706", border: "1px solid #1c221c", display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: '"SFMono-Regular", monospace' }}>
              <span style={{ color: "#798378" }}>Runaway Overage Risk:</span>
              <strong style={{ color: "#34d399" }}>$0.00 Guaranteed</strong>
            </div>
          </div>

          {/* Card 3: 6-col Bento Box */}
          <div className="mk-bento-card mk-bento-6" style={{ minHeight: "220px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ font: '700 9px/1 "SFMono-Regular", Consolas, monospace', color: "#34d399", letterSpacing: ".1em" }}>
                  03 / NO TICKET QUEUE
                </span>
                <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#8f988e" }}>
                  AUTOMATIC PROVISIONING
                </span>
              </div>
              <h3 style={{ fontSize: "21px", letterSpacing: "-.03em", margin: "0 0 10px", color: "#f5f6f4", fontWeight: 700 }}>
                Isolated PostgreSQL in seconds
              </h3>
              <p style={{ fontSize: "13px", lineHeight: "1.65", color: "#8f988e", margin: 0 }}>
                Every plan gets its own role and schema, provisioned the moment you ask — no approval queue, no ticket, no human waiting on the other end for agent test runs or new tenant databases.
              </p>
            </div>
            <div style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", fontFamily: '"SFMono-Regular", monospace', color: "#798378" }}>
              <span>Measured provisioning time:</span>
              <strong style={{ color: "#34d399" }}>~3s, typically under 5s</strong>
            </div>
          </div>

          {/* Card 4: 6-col Bento Box */}
          <div className="mk-bento-card mk-bento-6" style={{ minHeight: "220px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <span style={{ font: '700 9px/1 "SFMono-Regular", Consolas, monospace', color: "#34d399", letterSpacing: ".1em" }}>
                  04 / RECOVERY GUARDRAIL
                </span>
                <span style={{ font: '700 8px/1 "SFMono-Regular", monospace', color: "#8f988e" }}>
                  ONE-COMMAND UNDO
                </span>
              </div>
              <h3 style={{ fontSize: "21px", letterSpacing: "-.03em", margin: "0 0 10px", color: "#f5f6f4", fontWeight: 700 }}>
                Checkpoint &amp; Rollback
              </h3>
              <p style={{ fontSize: "13px", lineHeight: "1.65", color: "#8f988e", margin: 0 }}>
                If an autonomous agent hallucinates a faulty migration or drops a critical relation, restore the last checkpoint with one command — no manual pg_restore, no DBA on call.
              </p>
            </div>
            <div style={{ marginTop: "18px", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", fontFamily: '"SFMono-Regular", monospace', color: "#798378" }}>
              <span>Measured rollback time:</span>
              <strong style={{ color: "#34d399" }}>seconds, not manual hours</strong>
            </div>
          </div>
        </div>

        {/* Live Interactive Agent Simulator Playground */}
        <LiveAgentPlayground />

        {/* Copy-Pastable Code Tabs */}
        <AgentTabs />
      </section>

      {/* DEVELOPER WORKFLOW STORY */}
      <section className={styles.story} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.storyIntro}>
          <div>
            <span className={styles.kicker} style={{ color: "#34d399" }}>From empty project to connected app</span>
            <h2>The useful parts stay in view.</h2>
          </div>
          <p>
            The dashboard is built around the work developers and agents actually do: provision in milliseconds, copy TLS credentials, watch node saturation, restore instantly.
          </p>
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
                <div className={styles.credentialTop}><span>CONNECTION</span><span style={{ color: "#34d399" }}>READY</span></div>
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
              <h3>The connection string is ready for your app or agent.</h3>
              <p>Copy the URL into Prisma, Django, Rails, LangChain, Cursor or psql. Credentials can be rotated from the same database view.</p>
              <ul>
                <li><span>Pooling</span><strong>PgBouncer</strong></li>
                <li><span>Credentials</span><strong>copy, reveal, rotate</strong></li>
                <li><span>Migration</span><strong>pg_dump / pg_restore</strong></li>
              </ul>
            </div>
          </article>
        </div>
      </section>

      {/* INFRASTRUCTURE FLEET MONITOR */}
      <section className={styles.infra} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.infraInner}>
          <div className={styles.infraPhoto}>
            <img src={infraPhoto} alt="Close view of a populated server rack with network cabling" loading="lazy" />
            <a className={styles.photoCredit} href="https://unsplash.com/photos/a-rack-of-servers-in-a-server-room-2JJ3wBHu4_0" target="_blank" rel="noreferrer">Kevin Ache / Unsplash</a>
            <div className={styles.nodeOverlay}>
              <div className={styles.nodeOverlayTop}><span>NODE / NJ-01</span><span style={{ color: "#34d399" }}>ACCEPTING DATABASES</span></div>
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

      {/* PRICING PLANS */}
      <section className={styles.priceSection} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.priceLead}>
          <span className={styles.kicker} style={{ color: "#34d399" }}>Pricing</span>
          <h2>Fixed monthly plans. Zero loop surprises.</h2>
          <p>Start with the workload you have. Storage, connection limits and backup retention are published with each plan.</p>
          <Link className="mk-button mk-button-dark" href="/pricing">Compare plans <ArrowRight size={15} /></Link>
        </div>
        <div className={styles.priceTiles}>
          <div className={styles.priceTile}><span>DEV</span><strong>$1</strong><p>Agent sandboxes, experiments, and scratchpads.</p></div>
          <div className={styles.priceTile}><span>STARTER</span><strong>$3</strong><p>Small apps and multi-agent memory.</p></div>
          <div className={styles.priceTile}><span>PRODUCTION</span><strong>$5</strong><p>High-concurrency swarms and active apps.</p></div>
          <div className={styles.priceTile}><span>DEDICATED</span><strong>$9+</strong><p>Continuous reasoning &amp; reserved capacity.</p></div>
        </div>
      </section>

      {/* FINAL ACTION BANNER */}
      <section className={styles.final} style={{ position: "relative", zIndex: 2 }}>
        <img src={infraPhoto} alt="Server rack in a dark data center" loading="lazy" />
        <div className={styles.finalInner}>
          <div className={styles.finalCopy}>
            <span className={styles.kicker}>Ready for agents &amp; developers</span>
            <h2>Create a PostgreSQL database in seconds.</h2>
          </div>
          <Link className="mk-button mk-button-light" href="/login">Create database <ArrowRight size={16} /></Link>
        </div>
      </section>

      {/* Footer */}
      <SiteFooter />
    </main>
  );
}
