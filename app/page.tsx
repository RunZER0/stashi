import Link from "next/link";
import { ArrowRight, KeyRound, Rows3, Terminal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AmbientVideoBackground } from "@/components/ambient-video-background";
import { HeroVisual } from "./hero-visual";
import styles from "./marketing.module.css";

const fears = [
  {
    problem: "An agent loop runs all night.",
    answer: "Your bill doesn't move. It's flat.",
  },
  {
    problem: "An agent drops the wrong table.",
    answer: "One command brings it back.",
  },
  {
    problem: "An agent gets more access than it needs.",
    answer: "Every key is scoped, and revocable on its own.",
  },
  {
    problem: "Usage creeps toward a limit.",
    answer: "You see it before it's a support ticket.",
  },
];

const steps = [
  {
    icon: Terminal,
    label: "Ask",
    copy: "Tell Stashi what you need — from the console, or an agent calling the API directly.",
  },
  {
    icon: KeyRound,
    label: "Connect",
    copy: "A real Postgres URL comes back immediately. No queue, no approval.",
  },
  {
    icon: Rows3,
    label: "Work",
    copy: "Every write is watched. The risky ones get a checkpoint before they run.",
  },
];

const tools = ["Claude", "Cursor", "Windsurf", "LangChain", "LlamaIndex", "plain REST"];

export default function Home() {
  return (
    <main className={`${styles.page} mk-shell`} style={{ position: "relative" }}>
      <AmbientVideoBackground />
      <SiteHeader />

      {/* HERO — names the tension, resolves it in one line */}
      <section className={styles.hero} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker} style={{ color: "#1478fc", letterSpacing: ".12em" }}>
            Postgres for the agentic era
          </span>
          <h1 style={{ color: "#f5f4f6" }}>
            PostgreSQL your agents can actually be trusted with.
          </h1>
          <p style={{ color: "#a4a3ac" }}>
            Flat pricing from $1 a month. Every query audited. One command undoes a mistake
            before it becomes an incident.
          </p>
          <div className={styles.actions}>
            <Link className="mk-button mk-button-dark" href="/login">
              Create database <ArrowRight size={16} />
            </Link>
            <Link className="mk-button mk-button-quiet" href="#how-it-works">
              See how it works
            </Link>
          </div>
        </div>

        <HeroVisual />
      </section>

      {/* THE FEARS — short, plain, one line each */}
      <section className="mk-wrap" style={{ padding: "96px 0 80px", position: "relative", zIndex: 2 }}>
        <div style={{ maxWidth: "640px", marginBottom: "48px" }}>
          <span className={styles.kicker} style={{ color: "#1478fc" }}>
            Why this exists
          </span>
          <h2 style={{ fontSize: "clamp(32px, 3.6vw, 46px)", lineHeight: "1.05", letterSpacing: "-.055em", margin: "14px 0 0", color: "#f5f4f6" }}>
            Autonomous agents broke the old rules for who touches a database.
          </h2>
        </div>
        <div className={styles.fearList}>
          {fears.map((f) => (
            <div key={f.problem} className={styles.fearRow}>
              <span className={styles.fearProblem}>{f.problem}</span>
              <span className={styles.fearArrow}>→</span>
              <span className={styles.fearAnswer}>{f.answer}</span>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — three steps, no code */}
      <section id="how-it-works" className={styles.stepsSection} style={{ position: "relative", zIndex: 2 }}>
        <div className="mk-wrap">
          <div style={{ maxWidth: "560px", marginBottom: "56px" }}>
            <span className={styles.kicker} style={{ color: "#1478fc" }}>
              How it works
            </span>
            <h2 style={{ fontSize: "clamp(32px, 3.6vw, 46px)", lineHeight: "1.05", letterSpacing: "-.055em", margin: "14px 0 0", color: "#f5f4f6" }}>
              From nothing to a live database in seconds.
            </h2>
          </div>
          <div className={styles.stepGrid}>
            {steps.map((step, i) => (
              <div key={step.label} className={styles.stepCard}>
                <div className={styles.stepNumber}>0{i + 1}</div>
                <step.icon size={20} color="#1478fc" />
                <h3>{step.label}</h3>
                <p>{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKS WITH — names, not code */}
      <section className="mk-wrap" style={{ padding: "0 0 96px", position: "relative", zIndex: 2 }}>
        <div className={styles.toolsRow}>
          <span className={styles.toolsLabel}>Speaks MCP natively — works with</span>
          <div className={styles.toolsNames}>
            {tools.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASE */}
      <section className={styles.priceSection} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.priceLead}>
          <span className={styles.kicker} style={{ color: "#1478fc" }}>Pricing</span>
          <h2>Fixed monthly plans. Zero loop surprises.</h2>
          <p>Storage, connections, and backup retention are published with every plan. No metering.</p>
          <Link className="mk-button mk-button-dark" href="/pricing">Compare plans <ArrowRight size={15} /></Link>
        </div>
        <div className={styles.priceTiles}>
          <div className={styles.priceTile}><span>DEV</span><strong>$1</strong><p>Agent sandboxes and experiments.</p></div>
          <div className={styles.priceTile}><span>STARTER</span><strong>$3</strong><p>Small apps and agent memory.</p></div>
          <div className={styles.priceTile}><span>PRODUCTION</span><strong>$5</strong><p>Active production traffic.</p></div>
          <div className={styles.priceTile}><span>DEDICATED</span><strong>$9+</strong><p>Reserved capacity.</p></div>
        </div>
      </section>

      {/* DOCS POINTER — deep technical content lives here, not on the landing page */}
      <section className="mk-wrap" style={{ padding: "0 0 100px", position: "relative", zIndex: 2 }}>
        <div className={styles.docsPointer}>
          <div>
            <h3>Want the actual code?</h3>
            <p>MCP config, API examples, and how checkpoints work under the hood — no marketing copy.</p>
          </div>
          <Link className="mk-button mk-button-quiet" href="/docs">
            Read the docs <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
