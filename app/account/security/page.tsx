"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Key, Laptop, Github, CheckCircle2, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function SecurityPage() {
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const [securityData, setSecurityData] = useState<{
    email: string;
    linkedProviders: string[];
    activeSessions: Array<{ id: string; ipAddress?: string; userAgent?: string; createdAt: string }>;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/account/security")
      .then((r) => r.json())
      .then((d) => setSecurityData(d))
      .catch(() => {});
  }, [session]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters long." });
      return;
    }
    setPasswordLoading(true);
    setPasswordMsg(null);

    try {
      const res = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (res.error) {
        setPasswordMsg({ type: "error", text: res.error.message || "Failed to update password." });
      } else {
        setPasswordMsg({ type: "success", text: "Password changed successfully! Other sessions revoked." });
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setPasswordMsg({ type: "error", text: "Failed to update password." });
    } finally {
      setPasswordLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <main className="wrap-wide" style={{ padding: "60px 0" }}>
        <p>Loading security profile...</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="wrap-wide" style={{ padding: "60px 0" }}>
        <p>
          Please <Link href="/sign-in" style={{ color: "#56a0ff" }}>sign in</Link> to view your account security.
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
        <span className="mono section-index" style={{ color: "#56a0ff" }}>ACCOUNT & CREDENTIALS</span>
        <h1 style={{ fontSize: "32px", marginTop: "8px" }}>Security Settings</h1>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginTop: "4px" }}>
          Manage your authentication credentials, linked identity providers, and active sessions for{" "}
          <strong style={{ color: "var(--ink)" }}>{session.user.email}</strong>.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        {/* Change Password Card */}
        <section className="node-card" style={{ padding: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <Key size={20} style={{ color: "#56a0ff" }} />
            <h2 style={{ fontSize: "18px", margin: 0 }}>Password Management</h2>
          </div>
          <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "20px" }}>
            Update your master account password. Changing your password will invalidate all other active browser sessions.
          </p>

          {passwordMsg && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                background: passwordMsg.type === "success" ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${passwordMsg.type === "success" ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: passwordMsg.type === "success" ? "#86efac" : "#fca5a5",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {passwordMsg.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="auth-form" style={{ marginTop: 0 }}>
            <label>
              Current password
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <label>
              New password (min. 8 characters)
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
            <button className="button button-dark" type="submit" disabled={passwordLoading} style={{ marginTop: "10px" }}>
              {passwordLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* Linked Identities & Active Sessions */}
        <div style={{ display: "grid", gap: "24px" }}>
          <section className="node-card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Shield size={20} style={{ color: "#56a0ff" }} />
              <h2 style={{ fontSize: "18px", margin: 0 }}>Connected Identities</h2>
            </div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>
              Single sign-on providers linked to your Stashi account.
            </p>

            <div style={{ display: "grid", gap: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--line-dark)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Github size={16} />
                  <span style={{ fontSize: "13px" }}>GitHub</span>
                </div>
                <span className="tiny-badge tiny-success">CONNECTED</span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--line-dark)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "14px", fontWeight: "bold" }}>G</span>
                  <span style={{ fontSize: "13px" }}>Google</span>
                </div>
                <span className="tiny-badge tiny-success">CONNECTED</span>
              </div>
            </div>
          </section>

          <section className="node-card" style={{ padding: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <Laptop size={20} style={{ color: "#56a0ff" }} />
              <h2 style={{ fontSize: "18px", margin: 0 }}>Active Sessions</h2>
            </div>
            <div style={{ fontSize: "13px", color: "var(--muted)" }}>
              {securityData?.activeSessions && securityData.activeSessions.length > 0 ? (
                <div style={{ display: "grid", gap: "8px", marginTop: "12px" }}>
                  {securityData.activeSessions.map((s, idx) => (
                    <div
                      key={s.id}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(255, 255, 255, 0.02)",
                        border: "1px solid var(--line-dark)",
                        fontSize: "12px",
                      }}
                    >
                      <div>
                        <strong>Session {idx + 1}</strong> · {s.ipAddress || "Active IP"}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: "11px", marginTop: "2px" }}>
                        Started: {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>1 active session (this browser).</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
