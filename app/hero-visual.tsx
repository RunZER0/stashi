"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clipboard, RotateCcw, ShieldCheck, Terminal } from "lucide-react";
import styles from "./marketing.module.css";

const steps = [
  {
    label: "A migration runs",
    detail: "ALTER TABLE orders DROP COLUMN status",
    tone: "neutral" as const,
    icon: Terminal,
  },
  {
    label: "Stashi saves a checkpoint first",
    detail: "Every risky statement gets one, automatically",
    tone: "accent" as const,
    icon: ShieldCheck,
  },
  {
    label: "The migration was wrong",
    detail: "Column dropped, a release breaks",
    tone: "warn" as const,
    icon: AlertTriangle,
  },
  {
    label: "One command, fully restored",
    detail: "rollback_last_checkpoint() — zero data lost",
    tone: "good" as const,
    icon: RotateCcw,
  },
];

export function HeroVisual() {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText("npx -y @stashidb/mcp-server");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.storyCard} aria-label="How Stashi protects a database from a bad migration">
      <div className={styles.storyCardTop}>
        <span>SAFETY NET</span>
        <span className={styles.storyCardLive}>
          <span className={styles.storyCardDot} /> live on every plan
        </span>
      </div>

      <ol className={styles.storyTimeline}>
        {steps.map((step, i) => (
          <li key={step.label} className={styles.storyStep} data-tone={step.tone} style={{ animationDelay: `${i * 120}ms` }}>
            <span className={styles.storyStepMarker}>
              <step.icon size={11} strokeWidth={2.5} />
            </span>
            <div>
              <strong>{step.label}</strong>
              <code>{step.detail}</code>
            </div>
          </li>
        ))}
      </ol>

      <div className={styles.storyOutcome}>
        <ShieldCheck size={16} />
        <span>Risky changes do not have to be permanent.</span>
      </div>

      <button className={styles.storyCopy} onClick={copy} type="button">
        {copied ? <Check size={13} /> : <Clipboard size={13} />}
        <code>npx -y @stashidb/mcp-server</code>
      </button>
    </div>
  );
}
