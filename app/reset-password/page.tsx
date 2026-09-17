"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill out both password fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!token) {
      setError("Missing or invalid reset token. Please request a new password reset link.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (res.error) {
        setError(res.error.message || "Invalid or expired reset token.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Failed to reset password. The link may have expired or already been used.");
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
          <span className="mono section-index auth-kicker">NEW CREDENTIAL</span>
          <h1>Set new password</h1>
          <p>Choose a strong password to protect your Stashi databases and API access.</p>

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

          {success ? (
            <div style={{ marginTop: "24px", textAlign: "center", padding: "16px 0" }}>
              <CheckCircle2 size={40} style={{ color: "#56a0ff", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>Password updated</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                Your password has been successfully changed. You can now sign in with your new credentials.
              </p>
              <Link href="/sign-in" className="button button-dark" style={{ display: "inline-block", marginTop: "20px" }}>
                Proceed to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="auth-form" style={{ marginTop: "24px" }}>
              <label>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                />
              </label>

              <button className="button button-dark" type="submit" disabled={loading} style={{ width: "100%", marginTop: "12px" }}>
                {loading ? "Updating password..." : "Reset password"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#8a99a8" }}>
          Loading password reset...
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
