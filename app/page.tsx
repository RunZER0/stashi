import Link from "next/link";
import { ArrowRight, Braces, KeyRound, RotateCcw, Rows3, ShieldCheck, Terminal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AmbientVideoBackground } from "@/components/ambient-video-background";
import { HeroVisual } from "./hero-visual";
import styles from "./marketing.module.css";

const fears = [
  ["A workload runs longer than planned", "Your monthly plan stays predictable."],
  ["A migration changes the wrong thing", "A checkpoint is already waiting."],
  ["A service needs narrower access", "Its key is scoped and revocable."],
  ["A database starts reaching its limits", "The console makes it visible early."],
];

const steps = [
  { icon: Terminal, label: "Choose your surface", copy: "Use the console when you want to work directly, connect an application, or use MCP and the API in your workflows." },
  { icon: KeyRound, label: "Connect with intent", copy: "Create a database and give every person, service, and automation only the access it needs." },
  { icon: Rows3, label: "Move with a way back", copy: "Risky writes are checkpointed before they run, so a bad change does not have to become an incident." },
];

const tools = ["Claude", "Cursor", "Windsurf", "LangChain", "LlamaIndex", "plain REST"];

export default function Home() {
  return (
    <main className={`${styles.page} mk-shell`} style={{ position: "relative" }}>
      <AmbientVideoBackground />
      <SiteHeader />

      <section className={styles.hero} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.heroCopy}>
          <span className={styles.kicker}>Managed PostgreSQL with room to grow</span>
          <h1>Build with speed.<br />Operate with certainty.</h1>
          <p>Stashi is the clear, dependable Postgres foundation for applications, teams, and automated workflows—with fixed plans, scoped keys, audit visibility, and recovery built in.</p>
          <div className={styles.actions}>
            <Link className="mk-button mk-button-dark" href="/login">Start with Stashi <ArrowRight size={16} /></Link>
            <Link className="mk-button mk-button-quiet" href="#how-it-works">See how it works</Link>
          </div>
          <div className={styles.heroFacts}>
            <span><ShieldCheck size={14} /> Scoped credentials</span>
            <span><RotateCcw size={14} /> Recovery when it matters</span>
          </div>
        </div>
        <HeroVisual />
      </section>

      <section className={styles.controlSection} style={{ position: "relative", zIndex: 2 }}>
        <div className="mk-wrap">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>Built for real work</span>
            <h2>Your database should make growth feel less fragile.</h2>
            <p>Stashi turns the moments that typically create uncertainty—new releases, growing traffic, evolving access—into clear, recoverable states.</p>
          </div>
          <div className={styles.fearList}>
            {fears.map(([problem, answer], index) => (
              <div key={problem} className={styles.fearRow}>
                <span className={styles.fearIndex}>0{index + 1}</span>
                <span className={styles.fearProblem}>{problem}</span>
                <span className={styles.fearArrow}>→</span>
                <span className={styles.fearAnswer}>{answer}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.stepsSection} style={{ position: "relative", zIndex: 2 }}>
        <div className="mk-wrap">
          <div className={styles.sectionIntro}>
            <span className={styles.kicker}>A safe path to production</span>
            <h2>Make the next move feel obvious.</h2>
          </div>
          <div className={styles.stepGrid}>
            {steps.map((step, index) => (
              <div key={step.label} className={styles.stepCard}>
                <div className={styles.stepNumber}>0{index + 1}</div>
                <step.icon size={20} />
                <h3>{step.label}</h3>
                <p>{step.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-wrap" style={{ padding: "0 0 96px", position: "relative", zIndex: 2 }}>
        <div className={styles.toolsRow}>
          <span className={styles.toolsLabel}><Braces size={14} /> Built for apps, teams, and MCP workflows</span>
          <div className={styles.toolsNames}>{tools.map((tool) => <span key={tool}>{tool}</span>)}</div>
        </div>
      </section>

      <section className={styles.priceSection} style={{ position: "relative", zIndex: 2 }}>
        <div className={styles.priceLead}>
          <span className={styles.kicker}>Pricing</span>
          <h2>Costs you can keep in view.</h2>
          <p>Storage, connections, and backup retention are published with every plan. No opaque metering, no runaway loop surprises.</p>
          <Link className="mk-button mk-button-dark" href="/pricing">Compare plans <ArrowRight size={15} /></Link>
        </div>
        <div className={styles.priceTiles}>
          <div className={styles.priceTile}><span>DEV</span><strong>$2</strong><p>Experiments, prototypes, and personal projects.</p></div>
          <div className={styles.priceTile}><span>STARTER</span><strong>$3</strong><p>Small applications and growing products.</p></div>
          <div className={styles.priceTile}><span>PRODUCTION</span><strong>$5</strong><p>Active apps, integrations, and teams.</p></div>
          <div className={styles.priceTile}><span>DEDICATED</span><strong>$9+</strong><p>Reserved capacity.</p></div>
        </div>
      </section>

      <section className="mk-wrap" style={{ padding: "0 0 28px", position: "relative", zIndex: 2 }}>
        <div className={styles.docsPointer}>
          <div><h3>Ready to inspect the machinery?</h3><p>Read the connection guides, MCP setup, API examples, and exactly how Stashi handles checkpoints.</p></div>
          <Link className="mk-button mk-button-quiet" href="/docs">Read the docs <ArrowRight size={15} /></Link>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
