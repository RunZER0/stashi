"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [errorMessage, setErrorMessage] = useState<string | null>(token ? null : "Missing verification token.");

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    authClient
      .verifyEmail({
        query: { token },
      })
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setStatus("error");
          setErrorMessage(res.error.message || "Failed to verify email address. The token may be expired or already used.");
        } else {
          setStatus("success");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(err?.message || "Verification failed. Please try again.");
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

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
          <span className="mono section-index auth-kicker">EMAIL VERIFICATION</span>

          {status === "loading" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Loader2 size={36} className="animate-spin" style={{ color: "#56a0ff", margin: "0 auto 16px" }} />
              <h1>Verifying your email...</h1>
              <p>Please wait while we confirm your email address.</p>
            </div>
          )}

          {status === "success" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <CheckCircle2 size={44} style={{ color: "#56a0ff", margin: "0 auto 16px" }} />
              <h1>Email verified!</h1>
              <p>Your email address has been successfully verified. You now have full access to your Stashi projects.</p>
              <Link href="/console" className="button button-dark" style={{ display: "inline-block", marginTop: "24px" }}>
                Continue to Console →
              </Link>
            </div>
          )}

          {status === "error" && (
            <div style={{ textAlign: "center", padding: "16px 0" }}>
              <AlertCircle size={44} style={{ color: "#f87171", margin: "0 auto 16px" }} />
              <h1>Verification failed</h1>
              <p style={{ color: "#fca5a5", marginTop: "8px" }}>{errorMessage}</p>
              <div style={{ marginTop: "24px" }}>
                <Link href="/sign-in" className="button button-dark" style={{ display: "inline-block" }}>
                  Return to sign in
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#8a99a8" }}>
          Verifying email...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
