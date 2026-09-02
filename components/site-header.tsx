import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="mk-header mk-wrap">
      <Link className="mk-brand" href="/" aria-label="Stashi home">stashi<span>.</span></Link>
      <nav className="mk-nav" aria-label="Primary navigation">
        <Link href="/product">Product</Link>
        <Link href="/pricing">Pricing</Link>
      </nav>
      <div className="mk-actions">
        <Link className="mk-signin" href="/login">Sign in</Link>
        <Link className="mk-button mk-button-dark mk-button-small" href="/login">Create database <ArrowRight size={14} /></Link>
      </div>
    </header>
  );
}
