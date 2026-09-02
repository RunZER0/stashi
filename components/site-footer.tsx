import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-wrap mk-footer-inner">
        <div>
          <Link className="mk-brand" href="/">stashi<span>.</span></Link>
          <p>Managed PostgreSQL with fixed monthly plans.</p>
        </div>
        <div className="mk-footer-links">
          <Link href="/product">Product</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </div>
    </footer>
  );
}
