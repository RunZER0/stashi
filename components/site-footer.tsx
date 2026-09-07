import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-wrap mk-footer-inner">
        <div>
          <Link className="mk-brand" href="/" aria-label="Stashi home">
            <img src="/stashi-logo-light.png" alt="Stashi" height={36} style={{ height: "36px", width: "auto", display: "block" }} />
          </Link>
          <p>Managed PostgreSQL for applications, teams, and automated workflows, with fixed monthly pricing from $2 a month.</p>
        </div>
        <div className="mk-footer-links">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
