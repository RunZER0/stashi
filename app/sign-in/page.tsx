"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Github, Lock, Mail, AlertCircle, ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/console";
  const errorParam = searchParams.get("error");
  const errorDescParam = searchParams.get("error_description");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!errorParam) return null;
    if (errorParam === "access_denied") return "Sign-in was cancelled.";
    if (errorParam.includes("state")) return "Sign-in session expired or was cancelled. Please try again.";
    return errorDescParam || "Could not complete sign-in. Please try again.";
  });

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await authClient.signIn.email({
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to sign in. Please check your credentials.");
      } else {
        router.push(redirectTo);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (provider: "github" | "google") => {
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: redirectTo,
        errorCallbackURL: "/sign-in",
      });
      if (res?.error) {
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("denied") || msg.includes("cancel")) {
          setError("Sign-in was cancelled.");
        } else {
          setError(res.error.message || `Failed to sign in with ${provider}.`);
        }
        setLoading(false);
        return;
      }
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }
    } catch (err: any) {
      setError(err?.message || `Failed to sign in with ${provider}.`);
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
          <Link href="/" className="back-link">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>

        <section className="auth-panel">
          <span className="mono section-index auth-kicker">SECURE SIGN-IN</span>
          <h1>Start with control.</h1>
          <p>Sign in to your Stashi account to manage PostgreSQL databases, credentials, and authorizations.</p>

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

          <div className="auth-form" style={{ marginTop: "20px" }}>
            <button
              className="button button-dark"
              type="button"
              disabled={loading}
              onClick={() => handleSocialSignIn("github")}
              style={{ width: "100%" }}
            >
              <Github size={16} /> Continue with GitHub
            </button>
            <button
              className="button button-light"
              type="button"
              disabled={loading}
              onClick={() => handleSocialSignIn("google")}
              style={{ width: "100%" }}
            >
              <GoogleMark /> Continue with Google
            </button>
          </div>

          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              onClick={() => setShowEmailForm((prev) => !prev)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                padding: "8px 0",
                color: "var(--muted)",
                fontSize: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                letterSpacing: ".04em",
              }}
            >
              <div style={{ flex: 1, height: "1px", background: "rgba(68, 68, 81, 0.4)" }} />
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {showEmailForm ? "hide email sign-in" : "or continue with email"}
                <ChevronDown
                  size={14}
                  style={{
                    transform: showEmailForm ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </span>
              <div style={{ flex: 1, height: "1px", background: "rgba(68, 68, 81, 0.4)" }} />
            </button>
          </div>

          {showEmailForm && (
            <form onSubmit={handleEmailSignIn} className="auth-form" style={{ marginTop: "16px" }}>
              <label>
                Email address
                <div style={{ position: "relative" }}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </label>

              <label>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Password</span>
                  <Link href="/forgot-password" style={{ fontSize: "11px", color: "#56a0ff" }}>
                    Forgot?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </label>

              <button className="button button-dark" type="submit" disabled={loading} style={{ width: "100%", marginTop: "8px" }}>
                {loading ? "Signing in..." : "Sign in with Email"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(68, 68, 81, 0.4)", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
            <span>Don't have an account?</span>
            <Link href="/sign-up" style={{ color: "#56a0ff", fontWeight: 700 }}>
              Create an account →
            </Link>
          </div>

          <p className="mk-auth-legal" style={{ marginTop: "20px" }}>
            By continuing, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#8a99a8" }}>
          Loading sign in...
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4c50af" d="M24 44c5.4 0 10.3-2 14-5.3l-6.5-5.5C29.4 34.9 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.6 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.8l6.5 5.5C40.5 36.3 44 30.7 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}
