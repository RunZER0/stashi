import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/" className="brand" aria-label="Stashi Home">
            stashi<span className="brand-dot">.</span>
          </Link>
          <Link href="/" className="back-link" style={{ margin: 0 }}>
            <ArrowLeft size={14}/> Back
          </Link>
        </div>
        <section className="auth-panel">
          <span className="mono section-index" style={{ display: "block", marginBottom: "8px", color: "#34d399", letterSpacing: ".1em" }}>AUTHENTICATION</span>
          <h1>Sign in to Stashi.</h1>
          <p>Access your low-cost, agentic-tuned PostgreSQL instances, MCP credentials, and databases.</p>
          <form action="/api/session" method="post" className="auth-form">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus/>
            <button className="button button-dark" type="submit">Continue to Console <ArrowRight size={16}/></button>
          </form>
          <p className="mk-auth-legal">By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</p>
        </section>
      </div>
    </main>
  );
}
