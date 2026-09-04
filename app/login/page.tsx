import Link from "next/link";
import { ArrowLeft, Github } from "lucide-react";
import { signIn } from "@/auth";

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
          <div className="auth-form">
            <form action={async () => { "use server"; await signIn("github", { redirectTo: "/console" }); }}>
              <button className="button button-dark" type="submit" style={{ width: "100%" }}>
                <Github size={16}/> Continue with GitHub
              </button>
            </form>
            <form action={async () => { "use server"; await signIn("google", { redirectTo: "/console" }); }}>
              <button className="button button-light" type="submit" style={{ width: "100%" }}>
                <GoogleMark/> Continue with Google
              </button>
            </form>
          </div>
          <p className="mk-auth-legal">By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</p>
        </section>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.5 5.5C40.5 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z"/>
    </svg>
  );
}
