"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Check, X, AlertCircle, Database, Search, FileText, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AmbientVideoBackground } from "@/components/ambient-video-background";

function getScopeLabel(scope: string): { title: string; desc: string; icon: any } {
  switch (scope) {
    case "openid":
      return { title: "OpenID Identity", desc: "Verify your unique account identity", icon: ShieldCheck };
    case "profile":
      return { title: "User Profile", desc: "Read your name and display preferences", icon: User };
    case "email":
      return { title: "Email Address", desc: "View your verified email address", icon: User };
    case "offline_access":
      return { title: "Offline Access", desc: "Maintain access when you are not actively present", icon: ShieldCheck };
    case "emerald:search":
      return { title: "Search Emerald Legal Materials", desc: "Search judicial decisions, case law, and Kenyan statutes", icon: Search };
    case "emerald:read":
      return { title: "Read Emerald Documents", desc: "Read full text and metadata of indexed legal resources", icon: FileText };
    case "stashi:projects:read":
      return { title: "Read Stashi Projects", desc: "View project configurations and database lists", icon: Database };
    case "stashi:database:read":
      return { title: "Read Database Data", desc: "Run read queries against your databases", icon: Database };
    case "stashi:database:write":
      return { title: "Write Database Data", desc: "Insert, update, and delete database records", icon: Database };
    case "stashi:database:admin":
      return { title: "Administer Databases", desc: "Manage branches, checkpoints, and compute limits", icon: Database };
    case "stashi:api-keys:manage":
      return { title: "Manage API Keys", desc: "Create, view, and revoke API credentials", icon: ShieldCheck };
    default:
      return { title: scope, desc: `Access permission for ${scope}`, icon: ShieldCheck };
  }
}

function ConsentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const clientId = searchParams.get("client_id") || "";
  const scopeParam = searchParams.get("scope") || "openid profile email";
  const resourceParam = searchParams.get("resource") || "";

  const scopes = scopeParam.split(" ").filter(Boolean);

  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [clientName, setClientName] = useState<string>(clientId ? `App (${clientId.slice(0, 10)}...)` : "External Application");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionLoading && !session) {
      // Redirect to sign in with return path
      const currentUrl = typeof window !== "undefined" ? window.location.href : "/consent";
      router.push(`/sign-in?redirectTo=${encodeURIComponent(currentUrl)}`);
    }
  }, [session, sessionLoading, router]);

  const handleConsent = async (accept: boolean) => {
    setLoading(true);
    setError(null);

    try {
      // Call Better Auth OAuth consent endpoint
      const res = await fetch("/api/auth/oauth2/consent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accept,
          scope: accept ? scopeParam : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (data.redirectURI) {
        window.location.href = data.redirectURI;
      } else if (data.url) {
        window.location.href = data.url;
      } else if (!res.ok) {
        setError(data.message || data.error || "Failed to process authorization response.");
        setLoading(false);
      } else {
        router.push("/console");
      }
    } catch {
      setError("An unexpected network error occurred.");
      setLoading(false);
    }
  };

  if (sessionLoading || !session) {
    return (
      <main className="auth-page auth-page--immersive">
        <div style={{ color: "var(--muted)", fontSize: "14px" }}>Loading session...</div>
      </main>
    );
  }

  return (
    <main className="auth-page auth-page--immersive">
      <AmbientVideoBackground />
      <div className="auth-shell" style={{ position: "relative", zIndex: 2, maxWidth: "520px" }}>
        <div className="auth-topline">
          <Link href="/" className="brand" aria-label="Stashi Home">
            <img src="/stashi-logo-light.png" alt="Stashi" height={36} style={{ height: "36px", width: "auto" }} />
          </Link>
          <span className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
            OAUTH 2.1 CONSENT
          </span>
        </div>

        <section className="auth-panel" style={{ padding: "36px" }}>
          <span className="mono section-index auth-kicker">AUTHORIZATION REQUEST</span>
          <h1 style={{ fontSize: "28px" }}>Authorize {clientName}</h1>
          <p>
            An external client is requesting access to your Stashi account resources on behalf of{" "}
            <strong style={{ color: "var(--ink)" }}>{session.user.email}</strong>.
          </p>

          {resourceParam && (
            <div
              style={{
                marginTop: "16px",
                padding: "8px 12px",
                background: "rgba(86, 160, 255, 0.08)",
                border: "1px solid rgba(86, 160, 255, 0.2)",
                fontSize: "11px",
                fontFamily: "monospace",
                color: "#93c5fd",
                wordBreak: "break-all",
              }}
            >
              Target Resource: {resourceParam}
            </div>
          )}

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

          <div style={{ marginTop: "24px" }}>
            <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: ".06em", color: "var(--muted)", fontWeight: 700 }}>
              Requested Permissions
            </span>

            <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
              {scopes.map((s) => {
                const info = getScopeLabel(s);
                const IconComponent = info.icon;
                return (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "12px",
                      padding: "10px 14px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(68, 68, 81, 0.4)",
                    }}
                  >
                    <div style={{ color: "#56a0ff", marginTop: "2px" }}>
                      <IconComponent size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{info.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{info.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "32px" }}>
            <button
              type="button"
              className="button button-light"
              disabled={loading}
              onClick={() => handleConsent(false)}
              style={{ justifyContent: "center" }}
            >
              <X size={15} /> Deny
            </button>
            <button
              type="button"
              className="button button-dark"
              disabled={loading}
              onClick={() => handleConsent(true)}
              style={{ justifyContent: "center" }}
            >
              <Check size={15} /> {loading ? "Authorizing..." : "Authorize Access"}
            </button>
          </div>

          <div style={{ marginTop: "20px", textAlign: "center", fontSize: "11px", color: "var(--muted)" }}>
            Signed in as <strong>{session.user.email}</strong>. Not you?{" "}
            <Link href="/sign-in" style={{ color: "#56a0ff" }}>
              Switch account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ConsentPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#05070a", color: "#8a99a8" }}>
          Loading authorization details...
        </div>
      }
    >
      <ConsentContent />
    </Suspense>
  );
}

