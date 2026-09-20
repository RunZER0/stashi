"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Github, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const errorDescParam = searchParams.get("error_description");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!errorParam) return null;
    if (errorParam === "access_denied") return "Sign-up was cancelled.";
    if (errorParam.includes("state")) return "Sign-up session expired or was cancelled. Please try again.";
    return errorDescParam || "Could not complete sign-up. Please try again.";
  });
  const [verificationPending, setVerificationPending] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please complete all required fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (res.error) {
        setError(res.error.message || "Failed to create account. Email may already be in use.");
      } else {
        // If email verification is required
        if (process.env.NEXT_PUBLIC_REQUIRE_VERIFY === "true") {
          setVerificationPending(true);
        } else {
          router.push("/console");
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignUp = async (provider: "github" | "google") => {
    setLoading(true);
    setError(null);
    try {
      const res = await authClient.signIn.social({
        provider,
        callbackURL: "/console",
        errorCallbackURL: "/sign-up",
      });
      if (res?.error) {
        const msg = res.error.message?.toLowerCase() || "";
        if (msg.includes("denied") || msg.includes("cancel")) {
          setError("Sign-up was cancelled.");
        } else {
          setError(res.error.message || `Failed to sign up with ${provider}.`);
        }
        setLoading(false);
        return;
      }
      if (res?.data?.url) {
        window.location.href = res.data.url;
        return;
      }
    } catch (err: any) {
      setError(err?.message || `Failed to sign up with ${provider}.`);
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
            <ArrowLeft size={14} /> Sign In
          </Link>
        </div>

        <section className="auth-panel">
          <span className="mono section-index auth-kicker">CREATE ACCOUNT</span>
          <h1>Get started with Stashi.</h1>
          <p>Create your developer identity for PostgreSQL databases, MCP integrations, and machine agents.</p>

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

          {verificationPending ? (
            <div style={{ marginTop: "24px", textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={44} style={{ color: "#56a0ff", margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: "20px", marginBottom: "8px" }}>Check your inbox</h2>
              <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: "1.6" }}>
                We sent a verification link to <strong>{email}</strong>. Click the link to complete your registration.
              </p>
              <Link href="/sign-in" className="button button-dark" style={{ display: "inline-block", marginTop: "20px" }}>
                Return to sign in
              </Link>
            </div>
          ) : (
            <>
              <div className="auth-form" style={{ marginTop: "20px" }}>
                <button
                  className="button button-dark"
                  type="button"
                  disabled={loading}
                  onClick={() => handleSocialSignUp("github")}
                  style={{ width: "100%" }}
                >
                  <Github size={16} /> Sign up with GitHub
                </button>
                <button
                  className="button button-light"
                  type="button"
                  disabled={loading}
                  onClick={() => handleSocialSignUp("google")}
                  style={{ width: "100%" }}
                >
                  <GoogleMark /> Sign up with Google
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
                    {showEmailForm ? "hide email registration" : "or continue with email"}
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
                <form onSubmit={handleSignUp} className="auth-form" style={{ marginTop: "16px" }}>
                  <label>
                    Full name
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ada Lovelace"
                      required
                      autoComplete="name"
                    />
                  </label>

                  <label>
                    Email address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      autoComplete="email"
                    />
                  </label>

                  <label>
                    Password (min. 8 characters)
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                    />
                  </label>

                  <button className="button button-dark" type="submit" disabled={loading} style={{ width: "100%", marginTop: "8px" }}>
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </form>
              )}

              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid rgba(68, 68, 81, 0.4)", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--muted)" }}>
                <span>Already have an account?</span>
                <Link href="/sign-in" style={{ color: "#56a0ff", fontWeight: 700 }}>
                  Sign in →
                </Link>
              </div>
            </>
          )}

          <p className="mk-auth-legal" style={{ marginTop: "20px" }}>
            By registering, you agree to the <Link href="/terms">Terms of Service</Link> and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#8a99a8" }}>
          Loading sign up...
        </div>
      }
    >
      <SignUpContent />
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
