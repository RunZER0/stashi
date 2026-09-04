import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-wrap mk-footer-inner">
        <div>
          <Link className="mk-brand" href="/" aria-label="Stashi home">
            stashi<span>.</span>
          </Link>
          <p>Low-cost, agentic-tuned managed PostgreSQL with fixed monthly pricing from $1 a month.</p>
        </div>
        <div className="mk-footer-links">
          <Link href="/#agentic">Agentic Workflows</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
