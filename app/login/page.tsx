import Link from "next/link";
import { ArrowLeft, ArrowRight, Database } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link href="/" className="back-link"><ArrowLeft size={15}/> stashi.</Link>
        <section className="auth-panel">
          <div className="auth-mark"><Database size={18}/></div>
          <span className="mono section-index">ACCOUNT</span>
          <h1>Sign in to Stashi.</h1>
          <p>Use your email to continue to the database dashboard.</p>
          <form action="/api/session" method="post" className="auth-form">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus/>
            <button className="button button-dark" type="submit">Continue <ArrowRight size={16}/></button>
          </form>
          <p className="mk-auth-legal">By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.</p>
        </section>
      </div>
    </main>
  );
}
