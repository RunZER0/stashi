"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

interface AuthorizedApp {
  id: string;
  clientId: string;
  clientName?: string;
  clientUri?: string;
  scopes: string[];
  resources?: string[];
  createdAt: string;
}

export default function AuthorizedAppsPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [apps, setApps] = useState<AuthorizedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchApps = async () => {
    try {
      const res = await fetch("/api/account/authorized-apps");
      if (res.ok) {
        const data = await res.json();
        setApps(data.authorizedApps || []);
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchApps();
    }
  }, [session]);

  const handleRevoke = async (clientId: string, appName: string) => {
    if (!confirm(`Revoke access for "${appName}"? This will immediately invalidate its tokens.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/account/authorized-apps?clientId=${encodeURIComponent(clientId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: `Successfully revoked access for ${appName}.` });
        setApps((prev) => prev.filter((a) => a.clientId !== clientId));
      } else {
        setMessage({ type: "error", text: "Failed to revoke access." });
      }
    } catch {
      setMessage({ type: "error", text: "Network error while revoking application." });
    }
  };

  if (sessionLoading || loading) {
    return (
      <main className="wrap-wide" style={{ padding: "60px 0" }}>
        <p>Loading authorized applications...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="wrap-wide" style={{ padding: "60px 0" }}>
        <p>
          Please <Link href="/sign-in" style={{ color: "#56a0ff" }}>sign in</Link> to view authorized applications.
        </p>
      </main>
    );
  }

  return (
    <main className="wrap-wide" style={{ padding: "48px 0 80px" }}>
      <div style={{ marginBottom: "32px" }}>
        <Link href="/console" className="back-link" style={{ marginBottom: "16px", display: "inline-flex" }}>
          <ArrowLeft size={14} /> Back to Console
        </Link>
        <span className="mono section-index" style={{ color: "#56a0ff" }}>OAUTH 2.1 DELEGATION</span>
        <h1 style={{ fontSize: "32px", marginTop: "8px" }}>Authorized Applications</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
          External applications, MCP clients, and developer tools you have granted permission to access your Stashi resources.
        </p>
      </div>

      {message && (
        <div
          style={{
            marginBottom: "24px",
            padding: "10px 14px",
            background: message.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.12)",
            border: `1px solid ${message.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            color: message.type === "success" ? "#86efac" : "#fca5a5",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {message.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {apps.length === 0 ? (
        <section className="node-card" style={{ padding: "40px", textAlign: "center" }}>
          <KeyRound size={36} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "18px", marginBottom: "8px" }}>No authorized applications</h2>
          <p style={{ color: "var(--muted)", fontSize: "13px" }}>
            You have not connected any external third-party applications or MCP clients yet.
          </p>
        </section>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {apps.map((app) => {
            const name = app.clientName || `Application (${app.clientId.slice(0, 12)}...)`;
            return (
              <article key={app.id} className="node-card" style={{ padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h2 style={{ fontSize: "18px", margin: "0 0 6px" }}>{name}</h2>
                    <div className="mono" style={{ fontSize: "11px", color: "var(--muted)" }}>
                      Client ID: {app.clientId} · Authorized on {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button button-light"
                    onClick={() => handleRevoke(app.clientId, name)}
                    style={{ color: "#f87171", borderColor: "rgba(239, 68, 68, 0.3)", padding: "6px 12px", fontSize: "12px" }}
                  >
                    <Trash2 size={13} /> Revoke Access
                  </button>
                </div>

                {app.resources && app.resources.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>
                      Target Resource:
                    </span>
                    <span className="mono" style={{ fontSize: "11px", color: "#93c5fd", marginLeft: "8px" }}>
                      {app.resources.join(", ")}
                    </span>
                  </div>
                )}

                <div style={{ marginTop: "12px" }}>
                  <span style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, display: "block", marginBottom: "6px" }}>
                    Granted Scopes:
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {app.scopes.map((s) => (
                      <span
                        key={s}
                        className="mono"
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid var(--line-dark)",
                          color: "var(--ink)",
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
