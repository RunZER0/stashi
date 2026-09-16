"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: "/reset-password",
      });
      setSubmitted(true);
    } catch {
      // Prevent user enumeration: always show success message even on error
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page--immersive">
      <AmbientVideoBackground />
      <div className="auth-shell" style={{ position: "relative", zIndex: 2 }}>
        <div className="auth-topline">
          <Link href="/" className="brand" aria-label="Stashi Home">
            <img src="/stashi-logo-light.png" alt="Stashi" height={36} style={{ height: "36px", width: "auto" }} />
          </Link>
          <Link href="/sign-in" className="back-link">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>

        <section className="auth-panel">
          <span className="mono section-index auth-kicker">PASSWORD RECOVERY</span>
          <h1>Reset your password</h1>
          <p>Enter your account's email address and we'll send a secure single-use recovery link.</p>

          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "10px 14px",
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#fca5a5",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {submitted ? (
            <div style={{ marginTop: "24px", textAlign: "center", padding: "16px 0" }}>
              <CheckCircle2 size={40} style={{ color: "#56a0ff", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Check your inbox</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                If an account exists for <strong>{email}</strong>, we have sent password reset instructions. The link will expire in 15 minutes.
              </p>
              <Link href="/sign-in" className="button button-dark" style={{ display: "inline-block", marginTop: "20px" }}>
                Return to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: "24px" }}>
              <label>
                Account email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  autoComplete="email"
                />
              </label>

              <button className="button button-dark" type="submit" disabled={loading} style={{ width: "100%", marginTop: "12px" }}>
                {loading ? "Sending link..." : "Send reset link"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
