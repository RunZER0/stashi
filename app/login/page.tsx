import Link from "next/link";
import { ArrowLeft, ArrowRight, Database } from "lucide-react";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Link href="/" className="back-link"><ArrowLeft size={15}/> stashi.</Link>
        <section className="auth-panel">
          <div className="auth-mark"><Database size={18}/></div>
          <span className="mono section-index">CONTROL PLANE ACCESS</span>
          <h1>Sign in to Stashi.</h1>
          <p>For this MVP, any valid email opens the demo control plane. Production auth is designed to swap behind the same session boundary.</p>
          <form action="/api/session" method="post" className="auth-form">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus/>
            <button className="button button-dark" type="submit">Continue <ArrowRight size={16}/></button>
          </form>
          <div className="auth-note"><span className="status-dot"/> Demo environment · no card required</div>
        </section>
      </div>
    </main>
  );
}
